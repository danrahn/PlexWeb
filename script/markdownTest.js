/* exported testMarkdown, MarkdownTestSuite */

// Markdown files are the only ones that prefer single-quotes over double.
/* eslint quotes: ["error", "single", { "avoidEscape" : true, "allowTemplateLiterals" : true }] */
/* eslint-disable class-methods-use-this */

class MarkdownTestSuite
{
    /// <summary>
    /// Runs all available tests
    /// </summary>
    static runSuite()
    {
        let overallResults = { passed : 0, failed : 0 };
        const addResult = (suiteResults) =>
        {
            overallResults.passed += suiteResults.passed;
            overallResults.failed += suiteResults.failed;
        };

        // Simple tests for non-nested scenarios
        addResult(this.testHeaders());
        addResult(this.testUrl());
        addResult(this.testInline());
        addResult(this.testBold());
        addResult(this.testItalic());
        addResult(this.testStrikethrough());
        addResult(this.testUnderline());
        addResult(this.testHr());
        addResult(this.testBr());
        addResult(this.testTable());

        addResult(this.testMixed());
        addResult(this.testQuoteListNest());

        addResult(this.testBugFixes());

        logInfo('');
        let totalTests = overallResults.passed + overallResults.failed;
        logInfo(`Passed ${overallResults.passed} of ${totalTests} tests (${((overallResults.passed / totalTests) * 100).toFixed(2)}%)`);
        return overallResults;
    }

    static testHeaders()
    {
        let tests = this._buildTests(
            ['# Header 1', '<h1 id="header-1">Header 1</h1>'],
            ['## Header 2', '<h2 id="header-2">Header 2</h2>'],
            ['### Header 3', '<h3 id="header-3">Header 3</h3>'],
            ['#### Header 4', '<h4 id="header-4">Header 4</h4>'],
            ['##### Header 5', '<h5 id="header-5">Header 5</h5>'],
            ['###### Header 6', '<h6 id="header-6">Header 6</h6>'],
            ['####### Header 7', '<div class="mdDiv">####### Header 7</div>'],
            ['##Header 2', '<div class="mdDiv">##Header 2</div>'],
            ['  ## Header 2', '<h2 id="header-2">Header 2</h2>'],
            ['##   Header 2', '<h2 id="header-2">Header 2</h2>'],
            ['  ##   Header 2', '<h2 id="header-2">Header 2</h2>'],
            [' ## Header 2 ###  ', '<h2 id="header-2">Header 2</h2>'],
            ['# _Header_ ~~With~~ ++Formatting++', '<h1 id="header-with-formatting"><em>Header</em> <s>With</s> <ins>Formatting</ins></h1>'],
            ['# [Header With Link](https://danrahn.com)', '<h1 id="header-with-link"><a href="https://danrahn.com">Header With Link</a></h1>'],
            ['1. # Header in list', '<ol start="1"><li><h1 id="header-in-list">Header in list</h1></li></ol>'],
            ['* # Header in list', '<ul><li><h1 id="header-in-list">Header in list</h1></li></ul>'],
            ['> # Header in quote', '<blockquote><h1 id="header-in-quote">Header in quote</h1></blockquote>'],
            ['* > # Header in list quote', '<ul><li><blockquote><h1 id="header-in-list-quote">Header in list quote</h1></blockquote></li></ul>'],
        );

        return this._runSingleSuite(tests, 'Basic Header Functionality');
    }

    static testUrl()
    {
        let tests = this._buildTests(
            [
                '[Link](danrahn.com)',
                '<div class="mdDiv"><a href="danrahn.com">Link</a></div>'
            ],
            [
                '[Add some text here](https://danrahn.com)',
                '<div class="mdDiv"><a href="https://danrahn.com">Add some text here</a></div>'
            ],
            [
                '[https://backwards.com](Uh oh!)',
                '<div class="mdDiv"><a href="Uh%20oh!">https:&#x2f;&#x2f;backwards.com</a></div>'
            ],
            [
                '[Link[](danrahn.com)',
                '<div class="mdDiv">[Link<a href="danrahn.com"></a></div>'
            ],
            [
                '[Outer[Inner](inner.com)](outer.com)',
                '<div class="mdDiv"><a href="outer.com">Outer<a href="inner.com">Inner</a></a></div>'
            ]
        );

        return this._runSingleSuite(tests, 'Basic Url Functionality');
    }

    static testInline()
    {
        let tests = this._buildTests(
            ['`Inline Code`', this._divWrap('<code>Inline Code</code>')],
            ['\\`Inline Code`', this._divWrap('`Inline Code`')],
            ['``Inline ` Code``', this._divWrap('<code>Inline ` Code</code>')],
            ['`This isn\'t closed', this._divWrap('`This isn&#39;t closed')],
            ['`Hello _**++~~There~~++**_`', this._divWrap('<code>Hello _**++~~There~~++**_</code>')],
            ['`[Link](index.php)`', this._divWrap('<code>[Link](index.php)</code>')]
        );

        return this._runSingleSuite(tests, 'Basic Inline Functionality');
    }

    static testBold()
    {
        let tests = this._buildTests(
            ['**This is bold text**', this._divWrap('<strong>This is bold text</strong>')],
            ['** This is not bold text**', this._divWrap('** This is not bold text**')],
            ['Mismatched **Bold **Tags**', this._divWrap('Mismatched **Bold <strong>Tags</strong>')],
            ['****Nested Bold****', this._divWrap('<strong><strong>Nested Bold</strong></strong>')],
            [
                '****Different** **Nest** Patterns**',
                this._divWrap('<strong><strong>Different</strong> <strong>Nest</strong> Patterns</strong>')
            ],
            ['__This is bold text__', this._divWrap('<strong>This is bold text</strong>')],
            ['__ This is not bold text__', this._divWrap('__ This is not bold text__')],
            ['Mismatched __Bold __Tags__', this._divWrap('Mismatched __Bold <strong>Tags</strong>')],
            ['____Nested Bold____', this._divWrap('<strong><strong>Nested Bold</strong></strong>')],
            [
                '____Different__ __Nest__ Patterns__',
                this._divWrap('<strong><strong>Different</strong> <strong>Nest</strong> Patterns</strong>')
            ],
            ['__**Bold^2**__', this._divWrap('<strong><strong>Bold^2</strong></strong>')],
            ['__**Bold?__**', this._divWrap('<strong>**Bold?</strong>**')],
            ['**Multiline\nSupport**', this._divWrap('<strong>Multiline<br>Support</strong>')],
            ['**More\nThan\nTwo**', this._divWrap('<strong>More<br>Than<br>Two</strong>')],
            ['**Double\n\nNewline**', this._divWrap('**Double') + this._divWrap('Newline**')]
        );

        return this._runSingleSuite(tests, 'Basic Bold Functionality');
    }

    static testStrikethrough()
    {
        let tests = this._buildTests(
            ['~~This text has a line going through it~~', this._divWrap('<s>This text has a line going through it</s>')],
            ['~~ This is not strikethrough~~', this._divWrap('~~ This is not strikethrough~~')],
            ['Mismatched ~~Strikethrough ~~Tags~~', this._divWrap('Mismatched ~~Strikethrough <s>Tags</s>')],
            ['~~~~Nested Strikethrough~~~~', this._divWrap('<s><s>Nested Strikethrough</s></s>')],
            [
                '~~~~Different~~ ~~Nest~~ Patterns~~',
                this._divWrap('<s><s>Different</s> <s>Nest</s> Patterns</s>')
            ],
            ['~~Multiline\nSupport~~', this._divWrap('<s>Multiline<br>Support</s>')],
            ['~~More\nThan\nTwo~~', this._divWrap('<s>More<br>Than<br>Two</s>')],
            ['~~Double\n\nNewline~~', this._divWrap('~~Double') + this._divWrap('Newline~~')],
            ['~Single Marker~', this._divWrap('~Single Marker~')],
            ['~~~Odd Markers~~~', this._divWrap('~<s>Odd Markers</s>~')]
        );

        return this._runSingleSuite(tests, 'Basic Strikethrough Functionality');
    }

    static testUnderline()
    {
        let tests = this._buildTests(
            ['++This text is underlined++', this._divWrap('<ins>This text is underlined</ins>')],
            ['++ This is not underlined++', this._divWrap('++ This is not underlined++')],
            ['Mismatched ++Underline ++Tags++', this._divWrap('Mismatched ++Underline <ins>Tags</ins>')],
            ['++++Nested Underline++++', this._divWrap('<ins><ins>Nested Underline</ins></ins>')],
            [
                '++++Different++ ++Nest++ Patterns++',
                this._divWrap('<ins><ins>Different</ins> <ins>Nest</ins> Patterns</ins>')
            ],
            ['++Multiline\nSupport++', this._divWrap('<ins>Multiline<br>Support</ins>')],
            ['++More\nThan\nTwo++', this._divWrap('<ins>More<br>Than<br>Two</ins>')],
            ['++Double\n\nNewline++', this._divWrap('++Double') + this._divWrap('Newline++')],
            ['+Single Marker+', this._divWrap('+Single Marker+')],
            ['+++Odd Markers+++', this._divWrap('+<ins>Odd Markers</ins>+')]
        );

        return this._runSingleSuite(tests, 'Basic Strikethrough Functionality');
    }

    static testItalic()
    {
        let tests = this._buildTests(
            ['*This is italic text*', this._divWrap('<em>This is italic text</em>')],
            ['* This is not italic text*', '<ul><li>This is not italic text*</li></ul>'],
            ['Mismatched *italic *Tags*', this._divWrap('Mismatched *italic <em>Tags</em>')],
            [
                '**Different* *Nest* Patterns*',
                this._divWrap('<em><em>Different</em> <em>Nest</em> Patterns</em>')
            ],
            ['_This is italic text_', this._divWrap('<em>This is italic text</em>')],
            ['_ This is not italic text_', this._divWrap('_ This is not italic text_')],
            ['Mismatched _italic _Tags_', this._divWrap('Mismatched _italic <em>Tags</em>')],
            [
                '__Different_ _Nest_ Patterns_',
                this._divWrap('<em><em>Different</em> <em>Nest</em> Patterns</em>')
            ],
            ['_*italic^2*_', this._divWrap('<em><em>italic^2</em></em>')],
            ['_*italic?_*', this._divWrap('<em>*italic?</em>*')],
            ['_Multiline\nSupport_', this._divWrap('<em>Multiline<br>Support</em>')],
            ['_More\nThan\nTwo_', this._divWrap('<em>More<br>Than<br>Two</em>')],
            ['_Double\n\nNewline_', this._divWrap('_Double') + this._divWrap('Newline_')]
        );

        return this._runSingleSuite(tests, 'Basic Italic Functionality');
    }

    static testHr()
    {
        let tests = this._buildTests(
            ['---', '<hr />'],
            ['***', '<hr />'],
            ['___', '<hr />'],
            ['----------', '<hr />'],
            ['* * *', '<hr />'],
            ['  _    _    _    _', '<hr />']
        );

        return this._runSingleSuite(tests, 'Basic Horizontal Rule Functionality');
    }

    static testBr()
    {
        let tests = this._buildTests(
            ['A\nB', this._divWrap('A<br />B')],
            ['A\n\nB', this._divWrap('A') + this._divWrap('B')],
            ['A\nB\nC', this._divWrap('A<br />B<br />C')]
        );

        return this._runSingleSuite(tests, 'Basic Line Break Functionality');
    }

    static testTable()
    {
        let tests = this._buildTests(
            [
                // Basic, no bounding pipes
                'A|B|C\n---|---|---\nD|E|F',
                '<table><thead><tr><td>A</td><td>B</td><td>C</td></tr></thead><tbody><tr><td>D</td><td>E</td><td>F</td></tr></tbody></table>'
            ],
            [
                // Basic, bounding pipes
                '|A|B|C|\n|---|---|---|\n|D|E|F|',
                '<table><thead><tr><td>A</td><td>B</td><td>C</td></tr></thead><tbody><tr><td>D</td><td>E</td><td>F</td></tr></tbody></table>'
            ],
            [
                // Alignment
                '|A|B|C|\n|:---|:---:|---:|\n|D|E|F|',
                '<table>' +
                    '<thead>' +
                        '<tr><td align="left">A</td><td align="center">B</td><td align="right">C</td></tr>' +
                    '</thead>' +
                    '<tbody>' +
                    '<tr><td align="left">D</td><td align="center">E</td><td align="right">F</td></tr>' +
                    '</tbody>' +
                '</table>'
            ],
            [
                // Inline Formatting, no block formatting
                '|~~A~~|> B|* C|\n|---|---|---|\n|**D**|`E`|[F](markdown.php)|',
                '<table>' +
                    '<thead>' +
                        '<tr><td><s>A</s></td><td>&gt; B</td><td>* C</td></tr>' +
                    '</thead>' +
                    '<tbody>' +
                    '<tr><td><strong>D</strong></td><td><code>E</code></td><td><a href="markdown.php">F</a></td></tr>' +
                    '</tbody>' +
                '</table>'
            ]
        );

        return this._runSingleSuite(tests, 'Basic Table Functionality');
    }

    static testMixed()
    {
        let tests = this._buildTests(
            [
                '# ___Header_ [`1`](link)__',
                '<h1 id="header-1"><strong><em>Header</em> <a href="link"><code>1</code></a></strong></h1>'
            ],
            [
                '# ___Header__ [`1`](link)_',
                '<h1 id="header-1"><em><strong>Header</strong> <a href="link"><code>1</code></a></em></h1>'
            ],
            [
                '**_Hello_**',
                '<div class="mdDiv"><strong><em>Hello</em></strong></div>'
            ],
            [
                '**_Hello**_',
                '<div class="mdDiv"><strong>_Hello</strong>_</div>'
            ]
        );

        return this._runSingleSuite(tests, 'Basic Mixed Inline Elements');
    }

    /* eslint-disable max-lines-per-function */
    /// <summary>
    /// Tests various BlockQuote and (Un)OrderedList nesting possibilities
    /// All these cases are issues that have (hopefully) been fixed
    /// </summary>
    static testQuoteListNest()
    {
        let tests = this._buildTests(
            [
                '> 1. ListItem1\n> 2. ListItem2',
                '<blockquote><ol start="1"><li>ListItem1</li><li>ListItem2</li></ol></blockquote>'
            ],
            [
                '> 1. ListItem1\n> 1. ListItem2',
                '<blockquote><ol start="1"><li>ListItem1</li><li>ListItem2</li></ol></blockquote>'
            ],
            [
                '> * A\n>   1. B\n>   2. C\n> * D',
                '<blockquote><ul><li>A<br /><ol start="1"><li>B</li><li>C</li></ol></li><li>D</li></ul></blockquote>'
            ],
            [
                '> * A\n>> * B',
                '<blockquote><ul><li>A</li></ul><blockquote><ul><li>B</li></ul></blockquote></blockquote>'
            ],
            [
                '> * A\n>  > B',
                '<blockquote><ul><li>A<br /><blockquote>B</blockquote></li></ul></blockquote>'
            ],
            [
                '> * A\n>\n>   B',
                '<blockquote><ul><li>A<br /><br />B</li></ul></blockquote>'
            ],
            [
                '> * A\n>\n>>   B',
                '<blockquote><ul><li>A</li></ul><br /><blockquote>B</blockquote></blockquote>'
            ],
            [
                '> * A\n>  > * B',
                '<blockquote><ul><li>A<br /><blockquote><ul><li>B</li></ul></blockquote></li></ul></blockquote>'
            ],
            [
                '> 1. > * A',
                '<blockquote><ol start="1"><li><blockquote><ul><li>A</li></ul></blockquote></li></ol></blockquote>'
            ],
            [
                '* 2. >> A',
                '<ul><li><ol start="2"><li><blockquote><blockquote>A</blockquote></blockquote></li></ol></li></ul>'
            ],
            [
                '> * > A\n>\n> B',
                // Note: should we have a br after the ul?
                '<blockquote><ul><li><blockquote>A</blockquote></li></ul><br />B</blockquote>'
            ],
            [
                '> * > A\n> B',
                '<blockquote><ul><li><blockquote>A</blockquote>B</li></ul></blockquote>'
            ],
            [
                '> * > A\n>   >> B',
                '<blockquote><ul><li><blockquote>A<br /><blockquote>B</blockquote></blockquote></li></ul></blockquote>'
            ],
            [
                '> * > A\n>> C\n> D',
                '<blockquote><ul><li><blockquote>A</blockquote></li></ul><blockquote>C</blockquote>D</blockquote>'
            ]
        );

        return this._runSingleSuite(tests, 'Advanced Nested BlockQuote/Lists Functionality');
    }
    /* eslint-enable max-lines-per-function */

    /// <summary>
    /// Tests to ensure that bugs that were previously fixed no longer repro
    /// </summary>
    static testBugFixes()
    {
        let tests = this._buildTests(
            [
                '**a*\n\n* [*C\\n*',
                '*<em>a</em><ul><li>[<em>C\\n</em></li></ul>' // This is probably its own bug. We should have a surrounding div!
            ],
            [
                '> * A\n> B\n>> C',
                '<blockquote><ul><li>A<br />B</li></ul><blockquote>C</blockquote></blockquote>'
            ],
            [
                '> ## Header in blockquote',
                '<blockquote><h2 id="header-in-blockquote">Header in blockquote</h2></blockquote>'
            ],
            [
                '* **Hello** World',
                '<ul><li><strong>Hello</strong> World</li></ul>'
            ]
        );

        return this._runSingleSuite(tests, 'Fixed Bugs');
    }

    /// <summary>
    /// Manually test a single string to see its markdown output
    /// </summary>
    static testString(testStr)
    {
        logInfo(`Testing : ${testStr}`);
        return new Markdown().parse(testStr);
    }

    /// <summary>
    /// Runs a single test suite denoted by the given testName
    /// </summary>
    static _runSingleSuite(tests, testName)
    {
        logInfo(`Running suite: ${testName}`);
        return this._runCore(tests);
    }

    /// <summary>
    /// Core routine that actually runs the tests
    /// </summary>
    static _runCore(tests)
    {
        let stats = { passed : 0, failed : 0 };
        let logSav = g_logLevel;
        g_logLevel = LOG.Info;
        let colors = this._consoleColors(g_darkConsole);

        tests.forEach(function(str)
        {
            let result = new Markdown().parse(str.input);
            let displayInput = MarkdownTestSuite._escapeTestString(str.input);
            if (result == str.expected)
            {
                let logString = `    %cPassed!%c [%c${displayInput}%c]%c => %c[%c${str.expected}%c]`;
                logFormattedText(LOG.Info, logString, ...colors.success);
                ++stats.passed;
            }
            else
            {
                let fixedIndent = ' '.repeat(36); // Indent from the consolelog header
                let logString = `   %cFAIL!\n` +
                    `${fixedIndent}%cInput:    %c[%c${displayInput}%c]%c\n` +
                    `${fixedIndent}Expected: %c[%c${str.expected}%c]%c\n` +
                    `${fixedIndent}Actual:   %c[%c${result}%c]`;
                logFormattedText(LOG.Warn, logString, ...colors.failure);
                ++stats.failed;
            }
        });

        g_logLevel = logSav;
        logInfo(`Ran ${stats.passed + stats.failed} Tests: Passed: ${stats.passed}  -  Failed: ${stats.failed}`);
        return stats;
    }

    /// <summary>
    /// Creates an array of { input, expected } pairs from the
    /// given array of [input, expected] arrays
    /// </summary>
    static _buildTests(...tests)
    {
        let testStrings = [];
        for (let i = 0; i < tests.length; ++i)
        {
            testStrings.push({ input : tests[i][0], expected : tests[i][1] });
        }

        return testStrings;
    }

    /// <summary>
    /// Returns the given string with backslashes and newlines escaped, as it can be
    /// confusing to get actual newlines/backslashes in the input/expected strings
    /// </summary>
    static _escapeTestString(str)
    {
        str = str.replace(/\\/g, '\\\\');
        str = str.replace(/\n/g, '\\n');
        return str;
    }

    /// <summary>
    /// Returns the ordered array of color formatting for successful and failed tests
    /// </summary>
    static _consoleColors(dark)
    {
        let bracketClr = 'color: inherit';
        let textClr = `color: ${dark ? '#D1977F' : '#9E3379'}`;
        let arrowClr = `color: ${dark ? 'orange' : 'orangered'}`;
        let passClr = `color: ${dark ? '#00C000' : '#006000'}`;
        let failClr = `color: ${dark ? 'tomato' : 'red'}`;
        let successColors = [passClr, bracketClr, textClr, bracketClr, arrowClr, bracketClr, textClr, bracketClr];
        let failureColors =
        [
            failClr,
            arrowClr,
            bracketClr,
            textClr,
            bracketClr,
            arrowClr,
            bracketClr,
            textClr,
            bracketClr,
            arrowClr,
            bracketClr,
            textClr,
            bracketClr
        ];

        return { success : successColors, failure : failureColors };
    }

    /// <summary>
    /// Helper to add the containing mdDiv div that `parse` returns
    /// </summary>
    static _divWrap(str)
    {
        return `<div class="mdDiv">${str}</div>`;
    }
}
