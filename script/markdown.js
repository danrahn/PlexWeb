/*
Converts markdown to HTML. The goal is to create this without looking at any examples
online. That means that this will probably be hot garbage, but hopefully will work in
basic scenarios.
*/

/* exported Markdown */

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
    HtmlComment : 18,
    Superscript : 19,
    Subscript : 20,
    HtmlSpan : 21,
    HtmlStyle : 22,
};

/// <summary>
/// Maps a given State to its string representation. Used for logging only
/// </summary>
/* eslint-disable-next-line complexity, max-lines-per-function */ // Breaking up a switch is pointless
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
        case State.CodeBlock:
            return 'CodeBlock';
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
        case State.Superscript:
            return 'Superscript';
        case State.Subscript:
            return 'Subscript';
        case State.HtmlSpan:
            return 'HtmlSpan';
        case State.HtmlStyle:
            return 'HtmlStyle';
        default:
            return 'Unknown state: ' + state;
    }
};

/// <summary>
/// Returns whether `state` is allowed given the `current` state
/// </summary>
/// <param name="index">The current parse location</param>
/* eslint-disable-next-line complexity */
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
        case State.HtmlStyle:
            return false;
        case State.Header:
        case State.Bold:
        case State.Underline:
        case State.Italic:
        case State.Strikethrough:
        case State.Superscript:
        case State.Subscript:
        case State.Table:
            return !blockMarkdown(state); // Only inline features allowed
        case State.Url:
        case State.HtmlSpan:
            // Can have inline stuff here, though not in the internal context, so be careful
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
            Log.error('Unknown state: ' + current.state);
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
    /// Returns true if the given character is a whitespace character
    /// </summary>
    static _isWhitespace(ch)
    {
        return /\s/.test(ch);
    }

    /// <summary>
    /// Returns true if the given character is alphanumeric.
    /// That is, [\w], without the underscore
    /// </summary>
    static _isAlphanumeric(ch)
    {
        return /[a-zA-Z0-9]/.test(ch);
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

    _resetCore(text, inlineOnly)
    {
        this.text = text;
        this.sameText = false;
        this._inlineOnly = inlineOnly;
        this._cachedParse = '';
        this._parseTime = 0;
        this._inParse = false;
        this._runCache = [];
    }

    /// <summary>
    /// Resets the parser. If caching is enabled, only resets
    /// the internal state starting at the first difference we found
    /// in the text.
    /// </summary>
    /// <returns>The index to start parsing at</returns>
    _reset(text, inlineOnly, diffStart)
    {
        this._resetCore(text, inlineOnly);
        if (diffStart <= 0 || this.topRun === null || parseInt(localStorage.getItem('mdCache')) == 0)
        {
            this._urls = {};
            this._classes = { _count : 0 };
            this._globalStyle = { _count : 0 };
            this.topRun = new Run(State.None, 0 /*start*/, null /*end*/, null /*parent*/, this._globalStyle);
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

        // Now that we've found the run we're interrupting, we have to keep
        // going until we hit a block element, since the character we entered might
        // be what makes previous inline runs join into a block element
        if (i < this.topRun.innerRuns.length && !this.topRun.innerRuns[i].isBlockElement())
        {
            while (i > 0 && !this.topRun.innerRuns[i].isBlockElement())
            {
                --i;
            }
        }
        else
        {
            // In some cases inserted text is the bridge that connects two runs that are currently distinct.
            // To get around this, be on the safe side and also remove the previous run from the cache
            if (i != 0)
            {
                --i;
            }
        }

        this._trimCaches(i);

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
    /// Ensures that any cached styles or reference URLs that were defined
    /// past the new run cutoff are culled.
    /// </summary>
    _trimCaches(cutoffRun)
    {
        // Make sure we don't persist cached styles
        for (let dict of [this._classes, this._globalStyle])
        {
            let maxOrder = 0;
            for (const [styleKey, styles] of Object.entries(dict))
            {
                if (styleKey == '_count')
                {
                    continue;
                }

                for (const [key, value] of Object.entries(styles))
                {
                    if (value.start >= this.topRun.innerRuns[cutoffRun].start)
                    {
                        delete dict[styleKey][key];
                    }
                    else
                    {
                        maxOrder = Math.max(maxOrder, dict[styleKey][key].order);
                    }
                }
            }

            dict._count = maxOrder;
        }

        // Also trim invalidated URLs from our URL cache
        for (const [urlRef, urls] of Object.entries(this._urls))
        {
            let cutoff = 0;
            for (let i = urls.length - 1; i >= 0; --i)
            {
                if (urls[i].start < this.topRun.innerRuns[cutoffRun].start)
                {
                    break;
                }

                ++cutoff;
            }

            if (cutoff == urls.length)
            {
                delete this._urls[urlRef];
            }
            else if (cutoff > 0)
            {
                urls.splice(urls.length - cutoff, cutoff);
            }
        }
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
            Log.log("Can't call parse when we're already parsing!", 0, 0, Log.Level.Critical);
            return '';
        }

        // Make some assumptions about inlineOnly not continuing from a previous
        // parse and skip some of the checks below to save some time
        let i;
        if (inlineOnly)
        {
            this._resetCore(text, inlineOnly);
            this.text = text;
            this.topRun = new Run(State.None, 0 /*start*/, this.text.length, null /*parent*/, this._globalStyle);
            this.currentRun = this.topRun;
            this._inlineOnly = inlineOnly;
            i = 0;
        }
        else
        {
            // Do some initial pruning, and get rid of carriage returns
            text = this._trimInput(text).replace(/\r/g, '');
            if (this._cachedParse.length != 0 &&
                this._inlineOnly == inlineOnly &&
                this.text == text)
            {
                Log.tmi('Identical content, returning cached content');
                this.sameText = true;
                return this._cachedParse;
            }

            i = this._reset(text, inlineOnly, this._checkCache(text));
        }

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

        // Here we go...
        for (let i = start; i < this.text.length; ++i)
        {
            while (i == this.currentRun.end)
            {
                Log.tmi('Resetting to parent: ' + (this.currentRun.parent === null ? '(null)' : stateToStr(this.currentRun.parent.state)));
                this.currentRun = this.currentRun.parent;
            }

            i = this._dispatch(i);
        }

        Log.tmi(this.topRun, 'Parsing tree');
        this.markdownPresent = this.topRun.innerRuns.length != 0;
        let html = this.topRun.convert(this.text, this._inlineOnly).trim();
        this._cachedParse = html;
        this._inParse = false;
        let perfStop = window.performance.now();
        this._parseTime = perfStop - perfStart;
        if (this._inlineOnly)
        {
            Log.tmi(`Parsed inline markdown in ${perfStop - perfStart}ms`);
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

            Log.verbose(`Parsed markdown in ${perfStop - perfStart}ms ${str}`);
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
            case '0': case '1': case '2': case '3': case '4':
            case '5': case '6': case '7': case '8': case '9':
                this._checkList(index, true /*ordered*/);
                return index;
            case ' ':
                return this._checkSpace(index);
            case '<':
                return this._checkLessThan(index);
            case '|':
                return this._checkPipe(index);
            case '.':
                return this._checkImplicitUrl(index);
            case '^':
                return this._checkCaret(index);
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
            return this._indexOrParentEnd('\n', i) - 1;
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
        let linebreak = this._indexOrParentEnd('\n', index);
        let line = this.text.substring(this._lastNewline(index) + 1, linebreak);
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
        let newline = this._lastNewline(start);

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
        let header = new Header(start - headingLevel + 1, end, this.text, headingLevel, this.currentRun);
        this.currentRun = header;
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
        let dimen = /(.*)[[ ]([wh])=(\d+%?)(?:,h=(\d+%?))?$/.exec(result.text);
        let width = '';
        let height = '';
        if (dimen !== null)
        {
            if (dimen[4])
            {
                width = dimen[3];
                height = dimen[4];
            }
            else if (dimen[2] == 'w')
            {
                width = dimen[3];
            }
            else
            {
                height = dimen[3];
            }

            if (dimen[1])
            {
                result.text = dimen[1];
            }
            else
            {
                result.text = '_'; // For substring(1)
            }
        }

        new Image(start, result.end, result.text.substring(1), result.url, width, height, this.currentRun);
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
            // Workaround for html comments adding a div/too many breaks: if we're surrounded by
            // newlines, ignore one of them by including it in the run's span
            if (result.end < this.text.length && this.text[result.end] == '\n' && (i == 0 || this.text[i - 1] == '\n'))
            {
                ++result.end;
            }

            url = new ReferenceUrlDefinition(i, result.end, this.currentRun);
            i = result.end - 1;
        }

        this.currentRun = url;
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
            return this._indexOrParentEnd('\n', i) - 1;
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
            return this._indexOrParentEnd('\n', i) - 1;
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
            allowSingle : allowSingle,
            foundAlpha : false
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
        if (start != 0 && (Markdown._isAlphanumeric(this.text[start - 1]) || this._isEscaped(start)))
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
        if (Markdown._isWhitespace(this.text[sepInfo.index]))
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
                    format = new Bold(start, sepInfo.index, this.currentRun);
                    isSingle = true;
                }
                else
                {
                    format = new Italic(start, sepInfo.index, this.currentRun);
                    isSingle = true;
                }
                break;
            case '+':
                format = new Underline(start, sepInfo.index, this.currentRun);
                break;
            case '~':
                format = new Strikethrough(start, sepInfo.index, this.currentRun);
                break;
            default:
                Log.error(`How did we try to make a format with a '${sepInfo.separator}'?`);
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
            if (Markdown._isAlphanumeric(this.text[sepInfo.index - 1]))
            {
                sepInfo.foundAlpha = true;
            }
            else
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
        let nextChar = this.text[sepInfo.index];
        if (nextChar == '`' && !this._isEscaped(sepInfo.index))
        {
            let endInline = this._inlineEnd(sepInfo.index, blockEnd, true /*cache*/);
            if (endInline != -1)
            {
                sepInfo.index = endInline - 1;
                return 0;
            }
        }

        if (nextChar == '^' || nextChar == '~')
        {
            let params = { cache : true, state : nextChar == '^' ? State.Superscript : State.Subscript };
            let endSuperSub = this._superSubscriptEnd(sepInfo.index, params);
            if (endSuperSub != -1)
            {
                sepInfo.index = endSuperSub - 1;
                return 0;
            }
        }

        if (nextChar == '\n')
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

        if (nextChar != sepInfo.separator || this._isEscaped(sepInfo.index))
        {
            sepInfo.foundAlpha = sepInfo.foundAlpha || Markdown._isAlphanumeric(nextChar);
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

        if (sepInfo.tentativeIndex == blockEnd ||
            Markdown._isWhitespace(this.text[sepInfo.tentativeIndex]) ||
            (sepInfo.foundAlpha && this._isFormatChar(sepInfo.tentativeIndex)))
        {
            // BI doesn't have single sep check
            if ((!sepInfo.allowSingle && sepInfo.tentativeCount == 1) ||
                Markdown._isWhitespace(this.text[sepInfo.tentativeIndex - 1]))
            {
                sepInfo.index = sepInfo.tentativeIndex;
                return -1;
            }

            // Non alphanumeric + separators + whitespace. This might actually be an end
            sepInfo.tentativeCount = 1;
        }
        else if (Markdown._isWhitespace(this.text[sepInfo.index - 1]) ||
            (!sepInfo.foundAlpha && this._isFormatChar(sepInfo.index - 1)))
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
    /// Returns whether the given character is a potential format character
    ///
    /// Used to help determine what should/shouldn't be counted when looking for formatting bounds
    /// </summary>
    _isFormatChar(index)
    {
        let ch = this.text[index];
        return (ch == '*' || ch == '_' || ch == '+' || ch == '~') && !this._isEscaped(index);
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

        if (sepInfo.tentativeIndex != blockEnd && Markdown._isAlphanumeric(this.text[sepInfo.tentativeIndex]))
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
    /// Processes a tilde character, which could be the start of a code block,
    /// strikethrough formatting, or subscript
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkTilde(i)
    {
        if (this._isEscaped(i))
        {
            return i;
        }

        // Subscript if we have a single tilde followed immediately by an open paren
        let subscriptEnd = this._checkSuperSubscript(i);
        if (subscriptEnd != -1)
        {
            return subscriptEnd;
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
    /// Process a less-than character, which could be a raw HTML element.
    ///
    /// Currently supported:
    ///  * Line break - <br> or <br />
    ///  * Span - <span ...>...</span>
    ///  * Style - <style>...</style> - limited to classes defined in spans
    ///  * Comment - <!-- ... -->
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkLessThan(i)
    {
        if (this._isEscaped(i))
        {
            return i;
        }

        if (/^<br ?\/?>/.test(this.text.substring(i, i + 6)))
        {
            let br = new Break(i, this.text.indexOf('>') + 1, this.currentRun, true /*needsInsert*/);
            br.end = this.text.indexOf('>', i) + 1;
            return i;
        }

        // <span...>...</span>
        if (/^<span ?/i.test(this.text.substring(i, i + 6)))
        {
            let spanEnd = this._checkSpan(i);
            if (spanEnd != -1)
            {
                return spanEnd;
            }
        }

        if (/^<style>/i.test(this.text.substring(i, i + 7)))
        {
            let styleEnd = this._checkStyle(i);
            if (styleEnd != -1)
            {
                return styleEnd;
            }
        }


        if (this.text.substring(i, i + 4) != '<!--')
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
    /// Check whether we have a valid span starting at the given position,
    /// adding it to the Run list if found.
    ///
    /// Rules:
    ///  * A "raw" HTML span consists of the following elements:
    ///     1. '<span'
    ///     2. 0 or more X="Y" attribute pairs
    ///     3. '>'
    ///     4. Span content
    ///     5. '</span>'
    ///  * Only the 'style' and 'class' attributes are parsed, all others are discarded
    ///  * When parsing the style attribute, only whitelisted styling is allowed
    ///    (e.g. can't set font size to 200pt and overrun the document)
    /// </summary>
    /// <returns>
    /// The start of the span content if a valid span was found, otherwise -1
    /// </returns>
    _checkSpan(start)
    {
        let line = this.text.substring(start, this._indexOrParentEnd('\n', start));

        let spanBounds = this._spanBounds(line);
        if (!spanBounds)
        {
            return -1;
        }

        // Things will go poorly if there are escaped double-quotes, or
        // someone tries to use single-quotes instead.
        let attrs = {};
        let attrPair = / *([a-zA-Z]\w*)="([^"]+)"/g;
        let attrText = line.substring(0, spanBounds.endStart);
        for (const match of attrText.matchAll(attrPair))
        {
            attrs[match[1].toLowerCase()] = match[2];
        }

        if (Object.keys(attrs).length == 0 && !/^<span>/.test(attrText))
        {
            return -1;
        }

        let attr = {};
        if (attrs.style)
        {
            attr = this._parseInlineStyle(attrs.style, start);
        }

        let classes = [];
        if (attrs.class)
        {
            classes = attrs.class.toLowerCase().split(/\s+/);
        }

        let span = new HtmlSpan(
            start,
            start + spanBounds.endSpan + 7,
            spanBounds.endStart,
            attr,
            classes,
            classes.length ? this._classes : null,
            this.currentRun);
        this.currentRun = span;

        return start + spanBounds.endStart - 1;
    }

    /// <summary>
    /// Returns the bounds for the span that starts at the beginning
    /// of the given line, accounting for nested and escaped spans.
    /// </summary>
    /// <returns>
    /// An object containing the bounds of the start and end span tags, or null
    /// if we don't have a valid span that starts at the beginning of the line
    /// </returns>
    _spanBounds(line)
    {
        let balance = 0;
        let bounds = {
            endStart : 0,
            endSpan : 0
        };

        let spans = this._collectSpans(line);
        if (spans.start.length == 0 || spans.end.length == 0)
        {
            return null;
        }

        bounds.endStart = spans.start[0][0].length;

        let ssIndex = 0;
        let esIndex = 0;
        while (true)
        {
            if (ssIndex == spans.start.length)
            {
                if (spans.end.length - esIndex >= balance)
                {
                    bounds.endSpan = spans.end[esIndex + balance - 1].index;
                    return bounds;
                }

                return null;
            }

            if (esIndex == spans.end.length)
            {
                return null;
            }

            if (spans.start[ssIndex].index < spans.end[esIndex].index)
            {
                ++balance;
                ++ssIndex;
            }
            else // Assume >, since == should be impossible
            {
                --balance;
                if (balance == 0)
                {
                    bounds.endSpan = spans.end[esIndex].index;
                    return bounds;
                }

                ++esIndex;
            }
        }
    }

    /// <summary>
    /// Find all start and end span indicators in the given line
    /// </summary>
    _collectSpans(line)
    {
        let startSpans = [];
        for (const match of line.matchAll(/<span( +[A-Za-z]\w*="[^"]*" *)*>/g))
        {
            if (!this._isEscapedText(line, match.index))
            {
                startSpans.push(match);
            }
        }

        let endSpans = [];
        for (const match of line.matchAll(/<\/span>/g))
        {
            if (!this._isEscapedText(line, match.index))
            {
                endSpans.push(match);
            }
        }

        return {
            start : startSpans,
            end : endSpans
        };
    }

    /// <summary>
    /// Parses a raw style value and returns an object containing whether it's
    /// important and the base value (i.e. !important stripped away if needed)
    /// </summary>
    _parseStyleKV(key, value, start)
    {
        let ret =
        {
            key : key.toLowerCase().trim(),
            value : {
                style : value.trim(),
                important : false,
                start : start
            }
        };

        if (value.toLowerCase().endsWith('!important'))
        {
            ret.value.important = true;
            ret.value.style = value.substring(0, value.length - 10).trim();
        }

        return ret;
    }

    /// <summary>
    /// Parses a style="xyz" attribute tag
    /// </summary>
    /// <returns>
    /// A dictionary mapping style attributes to their values
    /// </returns>
    _parseInlineStyle(style, start)
    {
        let attr = {};
        let args = style.split(';');
        args.forEach(arg =>
        {
            let split = arg.indexOf(':');
            if (split != -1)
            {
                let kvp = this._parseStyleKV(arg.substring(0, split).trim(), arg.substring(split + 1).trim(), start);

                if (!attr[kvp.key] || kvp.important || !attr[kvp.key].important)
                {
                    attr[kvp.key] = { value : kvp.value.style, important : kvp.value.important, start : kvp.value.start };
                }
            }
        });

        return attr;
    }

    /// <summary>
    /// Returns the first index of 'find' in 'text', where 'find' is not
    /// escaped (i.e. preceded by an unescaped backslash)
    /// </summary>
    _unescapedIndex(text, find, start=0)
    {
        let index = text.indexOf(find, start);
        while (this._isEscapedText(text, index))
        {
            index = text.indexOf(find, index + 1);
        }

        return index;
    }

    /// <summary>
    /// Check whether we have a valid <style> tag starting at the given index
    ///
    /// Rules:
    ///  * Line starts with <style>
    ///  * Each style definition starts on its own line
    ///  * Only classes (".XYZ") are parsed
    ///  * Classes must start with a letter, and only contains letters and numbers
    ///  * Rules must be enclosed in curly braces
    ///  * Curly braces are not allowed in the definitions themselves
    ///  * Each class style must be on its own line, and be of the form 'key : value;'
    /// </summary>
    _checkStyle(start)
    {
        if (start != 0 && !/^\s*$/.test(this.text.substring(this._lastNewline(start), start)))
        {
            return -1;
        }

        let context = this.text.substring(start, this.currentRun.end - this.currentRun.endContextLength());
        let endStyle = this._unescapedIndex(context, '</style>');
        if (endStyle == -1)
        {
            return -1;
        }

        let text = context.substring(0, endStyle + 8);

        // Can't have anything nested, don't set current run, return the end of the style tag
        new HtmlStyle(start, start + endStyle + 8, this.currentRun);
        let newStart = start + endStyle + 7;

        // The matchAll regex below is extremely inefficient on invalid input (e.g. starting a <style> tag, and there's a </style>
        // tag thousands of characters later in the document, and nothing in between the tags is actually a style). First check
        // that we start with something that resembles a valid start tag, which combined with autocomplete of MarkdownEditor
        // should mitigate most issues.
        if (!/^<style>\s*(\/\*(?!\*\/).*\*\/)*\s*(((?:(?:\s*,\s*)?\.?(?:[a-zA-Z][a-zA-Z0-9]*))+)\s*{|\s*<\/style>)/g.test(text))
        {
            return newStart;
        }

        for (const match of text.matchAll(/\s*((?:(?:\s*,\s*)?\.?(?:[a-zA-Z][a-zA-Z0-9]*))+)\s*{([^}]*)}/g))
        {
            let identifiers = match[1].split(/\s*,\s*/);
            for (let identifier of identifiers)
            {
                this._addRulesToStyleCache(identifier, match[2], start);
            }
        }

        return newStart;
    }

    /// <summary>
    /// Parse a string of CSS rules and add them to the appropriate cache.
    /// </summary>
    _addRulesToStyleCache(identifier, rules, start)
    {
        identifier = identifier.toLowerCase();
        let dict = this._globalStyle;
        if (identifier.startsWith('.'))
        {
            identifier = identifier.substring(1);
            dict = this._classes;
        }

        if (!dict[identifier])
        {
            dict[identifier] = {};
        }

        let thisRule = dict[identifier];
        for (const style of rules.matchAll(/\n\s*([a-zA-Z][a-zA-Z-]*)\s*:\s*([^;]+);/g))
        {
            let kvp = this._parseStyleKV(style[1], style[2], start);
            if (!thisRule[kvp.key] || kvp.value.important || !thisRule[kvp.key].important)
            {
                thisRule[kvp.key] =
                {
                    order : dict._count++,
                    value : kvp.value.style,
                    important : kvp.value.important,
                    start : kvp.value.start
                };
            }
        }
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
        let prevNewline = this._lastNewline(start);
        let regex;

        regex = RegExp('^' + this._nestRegex() + '>$');
        if (!regex.test(this.text.substring(prevNewline + 1, start + 1).replace(/ /g, '')))
        {
            return;
        }

        let parentState = this.currentRun.state;
        if (newNestLevel > 1 && parentState != State.BlockQuote && parentState != State.ListItem)
        {
            Log.error('Something went wrong! ' +
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

        let lastNewline = this._lastNewline(start);
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

        bounds.tableStart = this._lastNewline(start) + 1;
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

        bounds.defineEnd = this._indexOrParentEnd('\n', bounds.headerEnd + 1);
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

        const validCol = /^:?-{3,}:?$/;
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
        let md = new Markdown();
        md._globalStyle = this._globalStyle;
        // Normal rows
        for (let row = 0; row < table.rows.length; ++row)
        {
            for (let col = 0; col < table.rows[row].length; ++col)
            {
                table.rows[row][col] = md.parse(table.rows[row][col], true /*inlineOnly*/);
            }
        }

        // Header row
        for (let col = 0; col < table.header.length; ++col)
        {
            table.header[col] = md.parse(table.header[col], true /*inlineOnly*/);
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
        let next = this._indexOrParentEnd('\n', newline + 1);
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
            next = this._indexOrParentEnd('\n', newline + 1);
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
            if (line[i] == '`' && !this._isEscapedText(line, i))
            {
                let inlineEnd = this._inlineEndCore(line, i, line.length, false /*cache*/);
                if (inlineEnd != -1)
                {
                    span += line.substring(i, inlineEnd);
                    i = inlineEnd - 1;
                    continue;
                }
            }

            if (line[i] == '|' && !this._isEscapedText(line, i))
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

        let inlineEnd;
        let cached = this._checkRunCache(start, State.InlineCode);
        if (cached)
        {
            inlineEnd = cached.end;
        }
        else
        {
            inlineEnd = this._inlineEnd(start, this.currentRun.end, false /*cache*/);
            if (inlineEnd == -1)
            {
                return -1;
            }
        }

        let inline = new InlineCodeRun(start, inlineEnd, this.text, this.currentRun);
        this.currentRun = inline;

        // Can't add anything to an inline block, so increment the cursor
        return inlineEnd;
    }

    /// <summary>
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
        let context = this.text.substring(this._lastNewline(start) + 1, start);

        // If our direct parent is a list, find its indentation level; we need to be indented two more than that
        if (this.currentRun.state == State.ListItem)
        {
            let listStart = this.currentRun.parent.start;
            params.minIndent = this.text.substring(this._lastNewline(listStart) + 1, listStart).length + 2;
            if (context.length < params.minIndent)
            {
                return false;
            }
        }

        if (!RegExp('^' + params.regexStr + '$').test(context))
        {
            return false;
        }

        // Language after the backtick. Generally only allow letters, but C++/C# should also be accounted for
        let match = this.text.substring(start + 3, params.newline + 1).match(/^ *([\w+#]*)\n/);
        if (!match)
        {
            return false;
        }

        params.language = match[1];
        return true;
    }

    /// <summary>
    /// Looks for the end of a backtick/tilde code block
    /// </summary>
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
        let prevNewline = this._lastNewline(start);
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
        }
        else
        {
            list = new UnorderedList(start, listEnd, nestLevel, this.currentRun);
        }

        this.currentRun = list;
    }

    /// <summary>
    /// Helper method that returns the first occurrence of str in the
    /// current text, starting at `start`. If not found, returns the
    /// end of the containing run (minus its end context length).
    /// </summary>
    _indexOrParentEnd(str, start)
    {
        let i = this.text.indexOf(str, start);
        let pe = this.currentRun.end - this.currentRun.endContextLength();
        return i == -1 || i > pe ? pe : i;
    }

    /// <summary>
    /// Helper that returns the index of the last linebreak before the given index
    /// </summary>
    _lastNewline(index)
    {
        return this.text.lastIndexOf('\n', index);
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

        // Set various regex that we don't always need, but the one time cost of creating RegExp we don't
        // always need is outweighed by the potential cost of continuously recreating them in the loop below
        this._setListEndLoopRegex(params);

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

            if (!this._checkNextListLineAndAdvance(params))
            {
                return params.end;
            }
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

    _setListEndLoopRegex(params)
    {
        let minspaces = (params.nestLevel + 1) * 2;
        params.nextLineIndented = RegExp(`^${params.linePrefixRegex} {${minspaces},}`);
        let spacePrefix = `${params.linePrefixRegex} {${minspaces - 2},${minspaces - 1}}`;
        params.nextLineContinuesList = params.wholeList ? RegExp(`^${spacePrefix}${params.ordered ? '\\d+\\.' : '\\*'} `) : '';

        if (params.wholeList)
        {
            params.nextLineIsNewListItem = RegExp(`^${params.linePrefixRegex} *(?:\\*|\\d+\\.) `);
            minspaces -= 2;
            params.sufficientIndent = RegExp(`^${params.linePrefixRegex} {${minspaces},}`);
            let oppositeListType = params.ordered ? '\\*' : '\\d+\\.';
            params.swappedListType = RegExp(`^${params.linePrefixRegex} {${minspaces},${minspaces + 1}}${oppositeListType} `);
        }
        else
        {
            params.endOfListItem = RegExp(`^${params.linePrefixRegex} {0,${minspaces - 1}}(?:\\*|\\d+\\.) `);
        }
    }

    _checkNextListLineAndAdvance(params)
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
            if (!params.nextLineIndented.test(params.nextline))
            {
                if (!params.wholeList || !params.nextLineContinuesList.test(params.nextline))
                {
                    params.end += (params.inBlockQuote ? 0 : 2);
                    return false;
                }
            }
        }
        else if (params.wholeList)
        {
            // Not a double newline, if it's a new listitem, it must be the same type of
            // list, or indented at least (nestLevel * 2) spaces. If it's not a new listitem,
            // any level of indentation is fine
            if (params.nextLineIsNewListItem.test(params.nextline))
            {
                // Also can't swap between ordered/unordered with the same nesting level
                if (!params.sufficientIndent.test(params.nextline) ||
                    params.swappedListType.test(params.nextline))
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
            if (params.endOfListItem.test(params.nextline))
            {
                params.end += (params.inBlockQuote ? 0 : 1);
                return false;
            }
        }

        params.end = params.next;
        params.newline = params.next;
        params.next = this._indexOrParentEnd('\n', params.next + 1);
        params.nextline = this.text.substring(params.newline + 1, params.next + 1);

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
        let end = this._indexOrParentEnd('\n\n', start);
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
                    i = this._parseUrlBacktick(urlParse, i);
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
        if (urlParse.toFind() != ']' || this._isEscaped(i))
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
            return i;
        }

        let inlineEnd = this._inlineEnd(i, urlParse.end, true /*cache*/);
        if (inlineEnd == -1)
        {
            return i;
        }

        return inlineEnd - 1;
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

        let urlEnd = this._indexOrParentEnd('\n', urlParse.start);
        if (urlEnd - (i + 2) < 1)
        {
            return true;
        }

        let ref = urlParse.ret.text.substring(1);
        if (!this._urls[ref])
        {
            this._urls[ref] = [];
        }

        this._urls[ref].push({ url : this.text.substring(i + 2, urlEnd), start : i });
        urlParse.ret.type = 2;
        urlParse.ret.end = urlEnd;
        return true;
    }

    /// <summary>
    /// Checks for an implicit link, i.e. unformatted text that looks like it could be a URL
    /// </summary>
    _checkImplicitUrl(start)
    {
        if (this._isEscaped(start) ||
            this._inSpecialContext(start) ||
            this.currentRun.state == State.Url)
        {
            return start;
        }

        // Check for a valid end first, as it's slightly
        // better at exiting early when necessary
        let linkEnd = this._implicitUrlEnd(start);
        if (linkEnd == -1)
        {
            return start;
        }

        let linkStart = this._implicitUrlStart(start);
        if (linkStart == -1)
        {
            return start;
        }

        new ImplicitUrl(linkStart, linkEnd, this.text.substring(linkStart, linkEnd), this.currentRun);
        return linkEnd - 1;
    }

    /// <summary>
    /// Find the probably start of a potential implicit link
    /// </summary>
    /// <returns>The start of the url, or -1 if a valid url start is not found</summary>
    _implicitUrlStart(start)
    {
        let min = this.currentRun.start;
        let innerLength = this.currentRun.innerRuns.length;
        if (innerLength != 0)
        {
            min = this.currentRun.innerRuns[innerLength - 1].end;
        }

        let validChar = /[a-z0-9-.]/i;
        while (start >= min)
        {
            // Domain names can include numbers, letters, and hyphens.
            // Also allow '.' for subdomains. Once/if we hit a '/', check
            // to see if we have a valid (ish) protocol. If we do, return the
            // full thing, otherwise return the index directly to the right of '/'
            if (validChar.test(this.text[start]))
            {
                --start;
                continue;
            }

            if (this.text[start] != '/')
            {
                return this._trimImplicitUrlStart(start + 1);
            }

            if (start - min < 5)
            {
                return this._trimImplicitUrlStart(start + 1);
            }

            if (this.text[start - 1] != '/' ||
                this.text[start - 2] != ':' ||
                !/[a-z]{3}/i.test(this.text.substring(start - 5, start - 2)))
            {
                return this._trimImplicitUrlStart(start + 1);
            }

            for (let idx = 6; idx <= 8; ++idx)
            {
                if (start - idx < min || !/[a-z]/i.test(this.text[start - idx]))
                {
                    return start - idx + 1;
                }
            }

            return this._trimImplicitUrlStart(start + 1);
        }

        return this._trimImplicitUrlStart(start + 1);
    }

    /// <summary>
    /// Trims excess '.' and '-' that might be at the front of our
    /// URL after the initial parse
    /// </summary>
    _trimImplicitUrlStart(start)
    {
        while (this.text[start] == '.' || this.text[start] == '-')
        {
            ++start;
        }

        return start;
    }

    /// <summary>
    /// Find the probably end to a potential implicit url
    /// </summary>
    /// <returns>The end of the url, or -1 if a valid url end is not found</summary>
    _implicitUrlEnd(start)
    {
        let max = this.currentRun.end - this.currentRun.endContextLength();
        if (this.currentRun.end == this.text.length)
        {
            --max;
        }

        let domainEnd = this._validImplicitUrlDomainEnd(start, max);
        if (domainEnd == -1)
        {
            return -1;
        }

        // Only way we can continue a website from here is to have a '/'
        if (domainEnd > max || this.text[domainEnd] != '/')
        {
            return domainEnd;
        }

        return this._implicitUrlContinuationEnd(domainEnd + 1, max);
    }

    /// <summary>
    /// Checks for a valid domain end (e.g. '.com') starting at the given start
    /// If a valid end is found, return the end of it, otherwise return -1
    /// </summary>
    _validImplicitUrlDomainEnd(start, max)
    {
        // First, find the end of the domain
        let domainEnd = start + 1;
        while (domainEnd <= max && /[a-z]/i.test(this.text[domainEnd]))
        {
            ++domainEnd;
        }

        let domain = this.text.substring(start + 1, domainEnd);
        if (!/^(?:com|org|net|edu|gov|de|ru|uk|jp|it|fr|nl|ca|au|es|ch|se|us|no|mil)$/.test(domain))
        {
            return -1;
        }

        if (domainEnd <= max && this.text[domainEnd] == ':')
        {
            // Check for a valid port
            let portStart = domainEnd + 1;
            let portEnd = portStart;
            while (portEnd <= max && /\d/.test(this.text[portEnd]))
            {
                ++portEnd;
            }

            let port = parseInt(this.text.substring(portStart, portEnd));
            if (!isNaN(port) && port > 0 && port < 65536)
            {
                return portEnd;
            }
        }

        return domainEnd;
    }

    /// <summary>
    /// Returns the final end index of an implicit URL
    /// </summary>
    _implicitUrlContinuationEnd(start, max)
    {
        let initial = start;
        let maybe = false;
        while (start <= max)
        {
            // Not an exact science, as a URL can contain a lot of things after the domain, especially
            // when things aren't always escaped. Because of that, there are three categories:
            // 1. Allowed - characters we always allow to be in URLs
            // 2. Disallowed - characters that always terminate a URL
            // 3. Grey - characters that might terminate a URL. If the next character is grey or disallowed,
            //    don't include this one in the URL. Otherwise if the next character is allowed, include this as well.
            switch (this.text[start])
            {
                case ' ':
                case ',':
                case '\n':
                case '"':
                case "'":
                    return start - (maybe ? 1 : 0);
                case ':':
                case ';':
                case '.':
                case '!':
                case ')':
                case '(':
                case '[':
                case ']':
                case '\\':
                    maybe = true;
                    break;
                default:
                    maybe = false;
                    break;
            }

            ++start;
        }

        if (maybe)
        {
            return start - 1;
        }

        return start == this.text.length ? start : initial;
    }

    /// <summary>
    /// Parses a caret ('^'), which may be the start of a superscripted run
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkCaret(start)
    {
        let end = this._checkSuperSubscript(start);
        if (end == -1)
        {
            return start;
        }

        return end;
    }

    /// <summary>
    /// Checks for either a superscript or subscript, depending on the character at the given index
    /// </summary>
    /// <returns>The position we should continue parsing from, or -1 if we did not find a valid run</returns>
    _checkSuperSubscript(start)
    {
        let end = 0;
        let parens = false;
        let state = this.text[start] == '^' ? State.Superscript : State.Subscript;
        let cached = this._checkRunCache(start, state);
        if (cached)
        {
            end = cached.end;
            parens = cached.parens;
        }
        else
        {
            let params = { parens : false, state : state };
            end = this._superSubscriptEnd(start, params);
            if (end == -1)
            {
                return end;
            }

            parens = params.parens;
        }

        let supsub;
        if (state == State.Superscript)
        {
            supsub = new Superscript(start, end, parens, this.currentRun);
        }
        else
        {
            supsub = new Subscript(start, end, parens, this.currentRun);
        }

        this.currentRun = supsub;

        return start + (parens ? 1 : 0);
    }

    /// <summary>
    /// Checks if there's a valid superscript at the given start index
    ///
    /// Rules:
    ///   1. A superscript must be proceeded by a non-whitespace character
    ///   2. If an open paren is the first character after the caret, the superscript continues until the matching close paren is found
    ///     * If no matching paren is found, rule #3 applies
    ///   3. If no paren is provided, the superscript continues until whitespace is found
    /// </summary>
    /// <param name="params">
    /// Object containing
    ///  parens : out parameter to let the caller know whether this superscript is wrapped with parens
    ///  cache  : true if we should cache a valid superscript in our run cache for later use
    /// </param>
    /// <returns>The end index of the superscript, or -1 if it is not valid</returns>
    _superSubscriptEnd(start, params)
    {
        let max = this.currentRun.end;
        if (this._isEscaped(start) ||
            start == max ||
            Markdown._isWhitespace(this.text[start + 1]))
        {
            return -1;
        }

        let end = -1;
        let match = false;
        if (this.text[start + 1] == '(')
        {
            end = this._findMatchingParen(start + 1, max);
            match = end != -1;
        }

        if (!match)
        {
            if (params.state == State.Subscript)
            {
                return -1;
            }

            end = Math.min(this._indexOrParentEnd(' ', start), this._indexOrParentEnd('\n', start));
        }

        params.parens = match;
        if (params.cache && !this._hasCachedRun(start, params.state))
        {
            this._runCache.push({ start : start, end : end, state : params.state, parens : match });
        }

        return end;
    }

    /// <summary>
    /// Find close paren that matches the open paren at the given start index
    /// </summary>
    /// <returns>The index of the matching close paren, or -1 if it could not be found before the given max</returns>
    _findMatchingParen(start, max)
    {
        let parens = 1;
        let end = start + 1;
        let newline = 0;
        while (end < max)
        {
            if (this.text[end] == '\n')
            {
                ++newline;
                if (newline == 2)
                {
                    // Double newline ends the run
                    return -1;
                }
            }
            else
            {
                newline = 0;
            }

            if (this._isEscaped(end))
            {
                ++end;
                continue;
            }

            if (this.text[end] == ')')
            {
                if (--parens == 0)
                {
                    return end + 1;
                }
            }
            else if (this.text[end] == '(')
            {
                ++parens;
            }

            ++end;
        }

        return -1;
    }

    /// <summary>
    /// Checks whether our run cache contains a run of the given state that starts
    /// at the given index
    /// <summary>
    /// <returns>The cached run info if found, false if not found</returns>
    _checkRunCache(start, state)
    {
        while (this._runCache.length != 0 && this._runCache[0].start < start)
        {
            Log.warn(this._runCache[0], 'Skipped cached run, currently at ' + start);
            this._runCache.splice(0, 1);
        }

        if (this._runCache.length != 0 && this._runCache[0].start == start && this._runCache[0].state == state)
        {
            return this._runCache.splice(0, 1)[0];
        }

        return false;
    }

    /// <summary>
    /// Returns whether a cached run of the given state exists at the given start
    /// </summary>
    /// <remarks>
    /// TODO: This should probably be removed in place of better initial detection.
    /// Right now this is only checked after we've already re-parsed the run
    /// </remarks>
    _hasCachedRun(start, state)
    {
        for (let i = 0; i < this._runCache.length && this._runCache[i].start <= start; ++i)
        {
            if (this._runCache[i].start == start && this._runCache[i].state == state)
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Helper that determines if we're currently in an inline code block.
    /// If we are, return the end index of the inline run
    /// </summary>
    _inlineEnd(i, end, cache)
    {
        return this._inlineEndCore(this.text, i, end, cache);
    }

    /// <summary>
    /// Core inlineEnd routine that takes an arbitrary string
    /// Special use by table parse to detect inline runs within a cell
    /// </summary>
    _inlineEndCore(text, i, end, cache)
    {
        let inline = 1;
        while (i + inline < end && text[i + inline] == '`')
        {
            ++inline;
        }

        let doubleNewline = text.indexOf('\n\n', i);
        let endInline = text.indexOf('`'.repeat(inline), i + inline);
        if (endInline == -1 || endInline >= end || (doubleNewline != -1 && endInline > doubleNewline))
        {
            return -1;
        }

        if (cache && !this._hasCachedRun(i, State.InlineCode))
        {
            this._runCache.push({ start : i, end : endInline + inline, state : State.InlineCode });
        }

        return endInline + inline;
    }

    /// <summary>
    /// Returns whether the character at the given index is escaped
    /// with a backslash. Takes into account the possibility of the
    /// backslash itself being escaped.
    /// </summary>
    _isEscaped(index)
    {
        return this._isEscapedText(this.text, index);
    }

    /// <summary>
    /// Returns whether the character at the given index in the
    /// given string is escaped with a backslash.
    /// </summary>
    _isEscapedText(text, index)
    {
        let bs = 0;
        while (index - bs > 0 && text[index - 1 - bs] == '\\')
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
    constructor(state, start, end, parent=null, globalStyle=null)
    {
        this.state = state;
        this.start = start;
        this.end = end;
        this.parent = parent;
        this.attributes = {};
        if (parent !== null)
        {
            parent.innerRuns.push(this);
        }

        // A bit hacky, but we only set the optional style dictionary in
        // the core Run, and make other classes access it via _globalStyle()
        if (!globalStyle && parent && parent.globalStyle)
        {
            this.globalStyle = parent.globalStyle;
        }
        else
        {
            this.globalStyle = globalStyle;
        }

        // List of Runs that are contained inside of this Run
        this.innerRuns = [];

        // HTML representation of this Run, generated after the run is `convert`ed.
        this.cached = '';

        // Some runs need to be recomputed regardless of whether they're cached
        this.volatile = false;

        Log.tmi(`Added ${stateToStr(state)}: start=${start}, end=${end}`);
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
        if (this.cached.length != 0 && !this.volatile)
        {
            return this.cached;
        }

        if (!inlineOnly && this.shouldProcessNewlines())
        {
            this.parseNewlines(initialText);
        }

        // Even the setup for logging can get expensive when 'convert' is called hundreds/thousands
        // of times. Do some faster short-circuiting before setting anything up.
        const shouldLogTmi = Log.getLevel() < Log.Level.Verbose;
        let ident = shouldLogTmi ? ' '.repeat((this._nestLevel() + (inlineOnly ? 1 : 0)) * 3) : ''; // Indent logging to indicate nest level
        if (shouldLogTmi)
        {
            Log.tmi(`${ident}Converting State.${stateToStr(this.state)} : ${this.start}-${this.end}. ${this.innerRuns.length} children.`);
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
                return text.replace(/\n+$/gm, ''); // Don't clear out spaces, but remove newlines
            default:
                Log.error('Unknown side: ' + side);
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
    /// Mark an element as volatile, which in turn forces
    /// all parent nodes to be volatile as well to ensure
    /// no cached values are used.
    /// <summary>
    _setVolatile()
    {
        this.volatile = true;
        let parent = this.parent;
        while (parent !== null)
        {
            parent.volatile = true;
            parent = parent.parent;
        }
    }

    /// <summary>
    /// Returns the dictionary of globally defined styles, or null
    /// if none was set.
    /// </summary>
    _globalStyle()
    {
        let current = this;
        while (current && !current.globalStyle)
        {
            current = current.parent;
        }

        return (current && current.globalStyle) ? current.globalStyle : null;
    }

    /// <summary>
    /// Returns a 'style="..."' string with the styles for the given
    /// tag, or an empty string if none are present.
    /// </summary>
    _addStyle(tag)
    {
        let styles = this._globalStyle();
        if (!styles || !styles[tag])
        {
            return '';
        }

        let style = '';
        for (const [attribute, styleInfo] of Object.entries(styles[tag]))
        {
            if (StyleHelper.allowedAttribute(attribute))
            {
                style += `${attribute}:${StyleHelper.limitAttribute(attribute, styleInfo.value)};`;
            }
        }

        if (style.length == 0)
        {
            this.volatile = false;
            return '';
        }

        this.volatile = true;
        return ` style="${style}"`;
    }

    /// <summary>
    /// Returns whether we should process newlines given our state
    ///
    /// Currently, we only process newlines in our top-level Run a nd
    /// within lists and blockquotes
    /// </summary>
    /* eslint-disable-next-line complexity */ // No need to break up a switch
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
            case State.Superscript:
            case State.Subscript:
            case State.HtmlSpan:
            case State.HtmlStyle:
                return false;
            default:
                Log.warn('Unknown state: ' + this.state);
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
                return true;
            default:
                return false;
        }
    }

    /// <summary>
    /// Returns whether the element is hidden/semi-block, in the sense
    /// that we don't want to count it as a block element when calculating
    /// divs/breaks, but do want to allow arbitrary newlines within them.
    /// </summary>
    isHiddenElement()
    {
        switch (this.state)
        {
            case State.HtmlStyle:
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
                // Some states are "semi-block" elements, meaning that while
                // we don't want to treat them like full block elements, we also
                // don't want to parse any newlines they contain.
                if (!this._inSemiBlockState(newline))
                {
                    doubles.push([newline, newline + offset]);
                }

                return parseResult;
            }
        }

        parseResult.breaks = this._addBreaks(newline, cNewlines, previousRun, nextRun, atTop, atBottom);
        return parseResult;
    }

    /// <summary>
    /// Returns whether the given index is in the middle of a semi-block/hidden element
    /// </summary>
    _inSemiBlockState(index)
    {
        if (this.isHiddenElement() && index > this.start && index < this.end)
        {
            return true;
        }

        for (const ele of this.innerRuns)
        {
            if (index >= ele.start && index <= ele.end && ele._inSemiBlockState(index))
            {
                return true;
            }
        }

        return false;
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
            let div = new Div(start, end, text, this);
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

        if (splice == 1 && this.innerRuns[insert].state == State.Div)
        {
            // Don't wrap a div in a div
            return 0;
        }

        let div = new Div(start, end, text, this);
        div.innerRuns = this.innerRuns.splice(insert, splice, div);
        div.parent = this;
        return 1 - splice;
    }

    /// <summary>
    /// Inserts a break in this run at the given index
    /// </summary>
    _insertBreak(index)
    {
        if (this._inSemiBlockState(index))
        {
            return 0;
        }

        if (this.innerRuns.length == 0 || this.innerRuns[0].start >= index)
        {
            this.innerRuns.splice(0, 0, new ImplicitBreak(index, this));
            return 1;
        }

        let lastRun = this.innerRuns[this.innerRuns.length - 1];
        if (index > lastRun.end || (index == lastRun.end && !lastRun.isHiddenElement()))
        {
            this.innerRuns.push(new ImplicitBreak(index, this));
            return 1;
        }

        for (let i = 1; i < this.innerRuns.length; ++i)
        {
            if (this.innerRuns[i].start >= index)
            {
                if (this.innerRuns[i].start == index + 1 &&
                    this.innerRuns[i].isHiddenElement() &&
                    this.innerRuns[i - 1].end == index &&
                    this.innerRuns[i - 1].isHiddenElement())
                {
                    return 0;
                }

                if (index < this.innerRuns[i - 1].end)
                {
                    // Some inline elements can extend multiple lines. If we're
                    // in the middle of one, don't add it and let the inline
                    // element do it itself.
                    if (this.innerRuns[i - 1].isBlockElement())
                    {
                        Log.warn('Only inline elements should be hitting this');
                    }

                    return 0;
                }

                this.innerRuns.splice(i, 0, new ImplicitBreak(index, this));
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
            newText = this.escapeChars(newText, '\\*`_+~<>|^()');
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
    /// Returns an attribute string of the form ' attr1="value1" attr2="value2"',
    /// to be appended to the opening tag of the current element.
    /// </summary>
    _getAttributes()
    {
        let result = '';
        /* eslint-disable-next-line guard-for-in */ // Object.entries explicitly ignores the prototype chain
        for (const [attribute, value] of Object.entries(this.attributes))
        {
            result += ` ${attribute}="${value}"`;
        }

        return result;
    }

    /// <summary>
    /// Helper for runs that have basic <X> </X> tags
    /// </summary>
    basicTag(tag, end)
    {
        return `<${end ? '/' : ''}${tag}${end ? '' : this._getAttributes() + this._addStyle(tag)}>`;
    }
}

/// <summary>
/// Run definition for a linebreak - <br>
/// </summary>
class Break extends Run
{
    constructor(start, end, parent)
    {
        super(State.LineBreak, start, end, parent);
    }

    tag(end) { return end ? '' : '<br />'; }

    // Override parent transform and return an empty string, as a break has no content
    transform(/*newText*/) { return ''; }
}

/// <summary>
/// Extension of Break used for breaks automatically inserted
/// into the document based on whitespace
/// </summary>
class ImplicitBreak extends Break
{
    constructor(start, parent)
    {
        // Don't pass in parent to super, because that
        // will cause us to add ourselves to our parent's
        // inn runs, which we've already done
        super(start, start + 1, null /*parent*/);
        this.parent = parent;
    }
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
        // Don't pass in parent here, because if we do we'll
        // add ourselves to its innerRuns, but we've already done that
        super(State.Div, start, end, null /*parent*/);
        this.text = text.substring(start, end);
        this.attributes.class = 'mdDiv';
        this.parent = parent;

        // As Divs are awkwardly inserted into our  tree,
        // make sure its volatile state matches its parent
        if (this.parent && this.parent.volatile)
        {
            this.volatile = true;
        }
    }

    /// <summary>
    /// Div tag adds the mdDiv class
    /// </summary>
    tag(end) { return this.basicTag('div', end); }

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
/// Helper class with static methods that restricts available CSS styles that can be applied
/// </summary>
class StyleHelper
{
    /// <summary>
    /// Map of letter/word spacing limits
    /// </summary>
    static limits =
    {
        spacing :
        {
            neg : { px :   7, pt :  5, em : 1 },
            pos : { px : 100, pt : 75, em : 7 }
        },
        font :
        {
            lower : { px :  8, pt :  6, em : 0.7 },
            upper : { px : 44, pt : 33, em : 3   }
        }
    };

    /// <summary>
    /// Return whether the given attribute can be added to an element's style
    /// </summary>
    static allowedAttribute(attribute)
    {
        switch (attribute)
        {
            case 'background-color':
            case 'color':
            case 'font-family':
            case 'font-size':
            case 'font-style':
            case 'font-weight':
            case 'letter-spacing':
            case 'text-decoration':
            case 'text-transform':
            case 'word-spacing':
                return true;
            default:
                return false;
        }
    }

    /// <summary>
    /// Ensure attributes have reasonable values
    /// </summary>
    static limitAttribute(attribute, value)
    {
        switch (attribute)
        {
            case 'letter-spacing':
            case 'word-spacing':
            case 'font-size':
            {
                // Don't let things get too crazy
                let parts = /^(-?)(\d*\.?\d+)(px|pt|em)$/.exec(value.trim());
                if (!parts)
                {
                    // Doesn't fit the mold, let it exists as-is, since
                    // the browser probably can't do anything with it anyway
                    return value;
                }

                let sign = parts[1] ? -1 : 1;
                let newVal = parseFloat(parts[2]);
                if (attribute == 'font-size')
                {
                    let limits = StyleHelper.limits.font;
                    newVal = Math.min(limits.upper[parts[3]], Math.max(limits.lower[parts[3]], newVal * sign));
                }
                else
                {
                    newVal = sign * Math.min(newVal, StyleHelper.limits.spacing[parts[1] ? 'neg' : 'pos'][parts[3]]);
                }

                return newVal + parts[3];
            }
            default:
                return value;
        }
    }
}

/// <summary>
/// Header - <h1-6>Content</h1-6>
/// </summary>
class Header extends Run
{
    /// <param name="headerLevel">The type of header, 1-6</param>
    /// <param name="text">Full markdown text, used to set the header element's id</param>
    constructor(start, end, text, headerLevel, parent)
    {
        super(State.Header, start, end, parent);
        this.headerLevel = headerLevel;
        this.text = text.substring(start, end);
    }

    startContextLength()
    {
        return this.headerLevel + 1;
    }

    /// <summary>
    /// Determine the "display text" of the given run, not caring about
    /// special characters for things like **formatting** because we strip
    /// it later anyway.
    /// </summary>
    /// <remarks>
    /// A lot of code for what it does, but the alternative is to create an
    /// HTML element, set the innerHTML, then grab the innerText. While much
    /// more concise, in limited testing this method is 5-7x faster than that,
    /// and especially faster in the expected case of limited formatting inside
    /// of the header.
    /// </remarks>
    _id(run)
    {
        // Fast case - no inner elements
        if (run.innerRuns.length == 0)
        {
            switch (run.state)
            {
                case State.Url:
                    return this.text.substring(run.start - this.start, run.end - run.endContextLength() - this.start);
                case State.Image:
                    return run.altText;
                case State.HtmlSpan:
                    return this.text.substring(run.start + run.startContextLength() - this.start, run.end - run.endContextLength() - this.start);
                default:
                    return this.text.substring(run.start - this.start, run.end - this.start);
            }
        }

        let innerText = '';
        if (run.start < run.innerRuns[0].start)
        {
            innerText += this.text.substring(run.start - this.start, run.innerRuns[0].start - this.start);
        }

        let innerRun;
        for (let i = 0; i < run.innerRuns.length; ++i)
        {
            innerRun = run.innerRuns[i];
            innerText += this._id(innerRun);
            if (i != run.innerRuns.length - 1 && innerRun.end < run.innerRuns[i + 1].start)
            {
                innerText += this.text.substring(innerRun.end - this.start, run.innerRuns[i + 1].start - this.start);
            }
        }

        if (run.end > innerRun.end)
        {
            switch (run.state)
            {
                case State.Url:
                    innerText += this.text.substring(innerRun.end - this.start, run.end - run.endContextLength() - this.start);
                    break;
                default:
                    innerText += this.text.substring(innerRun.end - this.start, run.end - this.start);
                    break;
            }
        }

        return innerText;
    }

    /// <summary>
    /// Header opening tag includes the id
    /// </summary>
    tag(end)
    {
        const hTag = `h${this.headerLevel}`;
        if (end)
        {
            let endTag = `</${hTag}>`;

            let id = this._id(this);
            id = id.replace(/[^ a-z0-9]/gi, '').trim().replace(/ +/g, '-').toLowerCase();
            if (/^\d/.test(id))
            {
                id = '_' + id;
            }

            this.cached = this.cached.replace('__ID__', id);
            return endTag;
        }

        return `<${hTag} id="__ID__"${this._addStyle(hTag)}>`;
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

    tag(end) { return this.basicTag('blockquote', end); }

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

    tag(end) { return this.basicTag('ul', end); }

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
        if (listStart != 1)
        {
            // start="X" is unnecessary when the list starts with 1
            this.attributes.start = listStart;
        }
    }

    startContextLength() { return 0; }
    endContextLength() { return 0; }

    tag(end) { return this.basicTag('ol', end); }

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

    tag(end) { return this.basicTag('li', end); }

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
    constructor(start, end, url, parent, setAttributes=true)
    {
        super(State.Url, start, end, parent);
        this.url = url;
        this.relative = true;
        this.hostname = '';

        // Links within the document should be all lowercase for consistency
        if (this.url.startsWith('#'))
        {
            this.url = this.url.toLowerCase();
        }

        if (setAttributes)
        {
            this._setAttributes();
        }
    }

    startContextLength() { return 1; }

    // The url should be stripped here, so subtract its length and ']()'
    endContextLength() { return this.url.length + 3; }

    tag(end) { return this.basicTag('a', end); }

    /// <summary>
    /// Call our parent transform method after first un-escaping some
    // additional characters ('[]')
    /// </summary>
    transform(newText, /*side*/)
    {
        return super.transform(this.escapeChars(newText, '[]'));
    }

    /// <summary>
    /// Determine whether we should make the url an absolute or relative
    /// link. Helpful for cases like [Google](google.com), which obviously
    /// should link to https://google.com, not https://mysite.com/google.com
    /// </summary>
    _realLink()
    {
        // Don't do any encoding on the URL, assume the user has done all necessary escaping,
        // as otherwise we might accidentally double-encode something.
        if (/^[a-zA-Z]{3,5}:\/\//.test(this.url))
        {
            this.relative = false;
            try
            {
                this.hostname = new URL(this.url).hostname.toLowerCase();
            }
            // eslint-disable-next-line no-empty
            catch {}

            return this.url;
        }

        let domain = this.url;
        let domainEnd = this.url.indexOf('/');
        if (domainEnd != -1)
        {
            domain = this.url.substring(0, domainEnd);
        }

        let portStart = domain.lastIndexOf(':');
        if (portStart != -1)
        {
            domain = domain.substring(0, portStart);
        }

        if (!/^[a-z0-9-.]+$/i.test(domain))
        {
            return this.url;
        }

        let tldStart = domain.lastIndexOf('.');
        if (tldStart == -1)
        {
            return this.url;
        }

        // Only check common TLDs. Worst case the user has to be
        // explicit about their links with uncommon TLDs.
        let tld = domain.substring(tldStart + 1);
        if (/^(?:com|org|net|edu|gov|de|ru|uk|jp|it|fr|nl|ca|au|es|ch|se|us|no|mil)$/.test(tld))
        {
            this.relative = false;
            this.hostname = domain.toLowerCase();
            return 'https://' + this.url;
        }

        return this.url;
    }

    /// <summary>
    /// Returns whether we think this URL is to an external website
    /// </summary>
    /// <remarks>
    /// WARNING: It is required to call _realLink before calling _external
    /// </remarks>
    _external()
    {
        // If we're directed to the same host, open in the same window.
        // Otherwise open in a new window.
        let windowHost = window.location.hostname.toLowerCase();
        if (this.relative || this.hostname == windowHost)
        {
            return false;
        }

        // Subdomain check
        let thisStart = this.hostname.lastIndexOf('.', this.hostname.lastIndexOf('.') - 1);
        let windowStart = windowHost.lastIndexOf('.', windowHost.lastIndexOf('.') - 1);
        return this.hostname.substring(thisStart + 1) != windowHost.substring(windowStart + 1);
    }

    /// <summary>
    /// Set all the relevant tag attributes for a link
    /// </summary>
    _setAttributes()
    {
        this.attributes.href = this._realLink();
        if (this._external())
        {
            this.attributes.target = '_blank';
            this.attributes.rel = 'noopener';
        }
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
        // We need to wait until we parse everything before setting attributes
        super(start, end, url, parent, false /*setAttributes*/);
        this.urls = urls;
        this.urlLink = url;

        // If the reference is defined after its first use, changes to the URL won't
        // be picked up if the URL is cached.
        this._setVolatile();
    }

    /// <summary>
    /// Called once the full markdown text has been parsed and
    /// replaces the url identifier with the actual url
    /// </summary>
    _convertUrl(end)
    {
        if (this.urlLink in this.urls)
        {
            let urlList = this.urls[this.urlLink];
            this.url = urlList[urlList.length - 1].url;
            this._setAttributes();
        }
        else if (!end)
        {
            // We'll hit this for the start and end tag, only show it the first time around
            Log.warn('Could not find link match for ' + this.url);
        }
    }


    endContextLength()
    {
        return this.urlLink.length + 3;
    }

    tag(end)
    {
        this._convertUrl(end);
        return super.tag(end);
    }
}


/// <summary>
/// Common class for elements that won't be rendered in the final
/// document, but will still be present in an HTML comment
/// </summary>
class HiddenElement extends Run
{
    tag(end) { return end ? ' -->' : '<!-- '; }

    // No transformation is necessary, other than ensuring
    // that the element doesn't try to escape it's comment
    transform(newText, /*side*/)
    {
        return newText.replace('-->', '--&gt;').trim();
    }
}

/// <summary>
/// Handles the reference link definition '[identifier]: url'.
/// Keeps the text around, but surrounds it in an HTML comment
/// so it isn't displayed.
/// </summary>
class ReferenceUrlDefinition extends HiddenElement
{
    constructor(start, end, parent)
    {
        super(State.HtmlComment, start, end, parent);
    }
}

/// <summary>
/// Implicit URLs that capture raw links the user provides
/// </summary>
class ImplicitUrl extends Url
{
    constructor(start, end, url, parent)
    {
        super(start, end, url, parent);
        this.url = url;
    }

    tag(end)
    {
        if (end)
        {
            return '</a>';
        }

        return this.basicTag('a', end) + super.transform(this.url);
    }

    /// <summary>
    /// We don't allow extra formatting inside of raw URL's, so
    /// we handle all display text in this.tag
    /// </summary>
    transform()
    {
        return '';
    }
}

/// <summary>
/// Images - <img src="url" alt="altText" width="x(%|px)" height="y(%|px)">
/// </summary>
class Image extends Url
{
    constructor(start, end, altText, url, width, height, parent)
    {
        super(start, end, url, parent, false /*setAttributes*/);
        this._setImageAttributes(altText, width, height);
        this.state = State.Image; // Override parent's State.Url
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

        return this.basicTag('img', end);
    }

    _setImageAttributes(altText, width, height)
    {
        this.attributes.src = this._realLink();
        let alt = super.transform(altText);
        if (alt.length > 0)
        {
            this.attributes.alt = alt;
        }

        width = this._parseDimension(width);
        height = this._parseDimension(height);
        if (!isNaN(width.value))
        {
            this.attributes.width = width.value + width.unit;
        }

        if (!isNaN(height.value))
        {
            this.attributes.height = height.value + height.unit;
        }
    }

    /// <summary>
    /// Parses the string width/height and converts it to an integer
    /// </summary>
    /// <returns>true if the dimension is given in percentage, false if pixels</returns>
    _parseDimension(dimen)
    {
        let unit = 'px';
        if (dimen.endsWith('px'))
        {
            dimen = parseInt(dimen.substring(0, dimen.length - 2));
        }
        else if (dimen.endsWith('%'))
        {
            dimen = parseInt(dimen.substring(0, dimen.length - 1));
            unit = '%';
        }
        else
        {
            dimen = parseInt(dimen);
        }

        return { value : dimen, unit : unit };
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

    tag(end) { return this.basicTag('pre', end); }

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

        Log.error("We're in a block quote, but didn't find the right number of markers");
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
        let blankMatchRegex = RegExp(this.nextLineRegex.substring(0, this.nextLineRegex.length - 4) + '(.*)');
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
                else if ((match = line.match(blankMatchRegex)))
                {
                    finalText += lineNumber + '\n';
                }
                else
                {
                    Log.warn('Error parsing indent code block line: ' + line);
                    finalText += lineNumber + super.transform(line) + '\n';
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

    tag(end) { return this.basicTag('table', end); }

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

    tag(end) { return this.basicTag('code', end); }

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

    tag(end) { return this.basicTag('strong', end); }
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

    tag(end) { return this.basicTag('em', end); }
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

    tag(end) { return this.basicTag('ins', end); }
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

    tag(end) { return this.basicTag('s', end); }
}

/// <summary>
/// Common base for superscript and subscript functionality
/// </summary>
class SuperSub extends InlineFormat
{
    constructor(start, end, paren, parent)
    {
        super(State.Superscript, start, end, parent);
        this.paren = paren;
    }

    startContextLength() { return this.paren ? 2 : 1; }
    endContextLength() { return this.paren ? 1 : 0; }
}

/// <summary>
/// Superscript - <sup>Content</sup>
/// </summary>
class Superscript extends SuperSub
{
    tag(end) { return this.basicTag('sup', end); }
}

/// <summary>
/// Subscript - <sub>Content</sub>
/// </summary>
class Subscript extends SuperSub
{
    tag(end) { return this.basicTag('sub', end); }
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

/// <summary>
/// Raw HTML span - <span[[ class="abc"] style="xyz"]>...</span>
///
/// Allows for additional text styling outside of explicit Markdown notation
/// </summary>
/// <param name="style">Inline styles defined on the span itself</param>
/// <param name="classes">An array (potentially empty) containing the class names for the span</param>
/// <param name="classStyles">
/// The global style object that contains all styles defined in an HtmlStyle element. This may be
/// incomplete when the HtmlSpan is constructed, so it should only be accessed at conversion time.
/// </param>
class HtmlSpan extends Run
{
    constructor(start, end, textStart, style, classes, classStyles, parent)
    {
        super(State.HtmlSpan, start, end, parent);
        this.textStart = textStart;
        this.classes = classes;
        this.inlineStyle = style;
        this.classStyles = classStyles;

        // If we have a class definition, mark this as volatile
        // so changes to the class are always picked up.
        if (this.classes.length != 0)
        {
            this._setVolatile();
        }
    }

    startContextLength() { return this.textStart; }
    endContextLength() { return 7; }

    tag(end)
    {
        if (end)
        {
            return this.basicTag('span', end);
        }

        return `<span${this._computeStyleString()}>`;
    }

    /// <summary>
    /// Computes and returns the finalized style for the span.
    /// Inline styles take precedence over class styles, and
    /// duplicate class styles are won by the most recently defined value.
    /// </summary>
    _computeStyleString()
    {
        let importantStyles = {};
        let classStyles = this._populateClassStyles(importantStyles);
        let inline = this._populateInlineStyles();
        let added = {};
        let styleString = '';
        for (const [key, value] of Object.entries(inline))
        {
            if (key in importantStyles && !value.important)
            {
                continue;
            }

            styleString += `${key}:${value.value};`;
            added[key] = true;
        }

        for (const style of classStyles)
        {
            if (added[style.key])
            {
                continue;
            }

            styleString += `${style.key}:${style.value};`;
            added[style.key] = true;
        }

        if (styleString.length == 0)
        {
            return '';
        }

        return ` style="${styleString}"`;
    }

    /// <summary>
    /// Determine the order of class styles to apply and return it as an array
    /// </summary>
    /// <returns>
    /// An array of styles ordered from most- to least-recently defined, ensuring
    /// styles declared later in the file overwrite previously defined values.
    /// </returns>
    _populateClassStyles(importantStyles)
    {
        let styleList = [];
        for (let className of this.classes)
        {
            if (!this.classStyles[className])
            {
                continue;
            }

            for (const [key, value] of Object.entries(this.classStyles[className]))
            {
                if (value.important)
                {
                    importantStyles[key] = true;
                }

                styleList.push({
                    key : key,
                    value : StyleHelper.limitAttribute(key, value.value),
                    order : value.order,
                    important : value.important
                });
            }
        }

        styleList.sort((a, b) => a.important == b.important ? b.order - a.order : b.important ? 1 : -1);

        return styleList;
    }

    _populateInlineStyles()
    {
        let newStyles = {};
        for (const [key, value] of Object.entries(this.inlineStyle))
        {
            if (StyleHelper.allowedAttribute(key))
            {
                newStyles[key] = { value : StyleHelper.limitAttribute(key, value.value), important : value.important };
            }
        }
        return newStyles;
    }
}

/// <summary>
/// Handles custom <style>s by wrapping it in an HTML comment
/// </summary>
class HtmlStyle extends HiddenElement
{
    constructor(start, end, parent)
    {
        super(State.HtmlStyle, start, end, parent);
    }
}
