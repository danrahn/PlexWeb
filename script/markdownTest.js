/* exported testMarkdown, MarkdownTestSuite */

// Markdown files are the only ones that prefer single-quotes over double.
/* eslint quotes: ["error", "single", { "avoidEscape" : true, "allowTemplateLiterals" : true }] */
/* eslint-disable class-methods-use-this */

// The only methods (currently) over the maximum are just lists of relevant tests
/* eslint-disable max-lines-per-function */

class MarkdownTestSuite
{
    /// <summary>
    /// Runs all available tests
    /// </summary>
    static runSuite(testCache = false)
    {
        MarkdownTestSuite.testCache = testCache;
        let overallResults = { passed : 0, failed : 0 };
        const addResult = (suiteResults) =>
        {
            overallResults.passed += suiteResults.passed;
            overallResults.failed += suiteResults.failed;
        };

        // Simple tests for non-nested scenarios
        addResult(this.testHeaders());
        addResult(this.testUrl());
        addResult(this.testReferenceUrl());
        addResult(this.testImplicitUrl());
        addResult(this.testInline());
        addResult(this.testBold());
        addResult(this.testItalic());
        addResult(this.testStrikethrough());
        addResult(this.testUnderline());
        addResult(this.testSuperscript());
        addResult(this.testSubscript());
        addResult(this.testHr());
        addResult(this.testBr());
        addResult(this.testTable());
        addResult(this.testBacktickCodeBlock());
        addResult(this.testTildeCodeBlock());
        addResult(this.testMixedBacktickTildeCodeBlock());
        addResult(this.testIndentCodeBlock());
        addResult(this.testOrderedList());
        addResult(this.testUnorderedList());

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
            ['1. # Header in list', '<ol><li><h1 id="header-in-list">Header in list</h1></li></ol>'],
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

    static testReferenceUrl()
    {
        // Real sparse testing. Needs to be expanded
        let tests = this._buildTests(
            [
                '[A][1]\n[1]: b.com',
                '<a href="b.com">A</a><!-- [1]: b.com -->' // This should be divWrapped. Bug?
            ],
            [
                '[1]: b.com\n[A][1]',
                `<!-- [1]: b.com -->${this._divWrap('<a href="b.com">A</a>')}`
            ]
        );

        return this._runSingleSuite(tests, 'Reference Urls');
    }

    static testImplicitUrl()
    {
        let tests = this._buildTests(
            [
                'danrahn.com',
                this._divWrap('<a href="https://danrahn.com">danrahn.com</a>')
            ],
            [
                'Welcome to danrahn.com!',
                this._divWrap('Welcome to <a href="https://danrahn.com">danrahn.com</a>!')
            ],
            [
                'Welcome to danrahn.com.',
                this._divWrap('Welcome to <a href="https://danrahn.com">danrahn.com</a>.')
            ],
            [
                'Welcome to danrahn.org!',
                this._divWrap('Welcome to <a href="https://danrahn.org">danrahn.org</a>!')
            ],
            [
                'Welcome to danrahn.net!',
                this._divWrap('Welcome to <a href="https://danrahn.net">danrahn.net</a>!')
            ],
            [
                'Welcome to danrahn.de!',
                this._divWrap('Welcome to <a href="https://danrahn.de">danrahn.de</a>!')
            ],
            [
                'Welcome to danrahn.bad!',
                this._divWrap('Welcome to danrahn.bad!')
            ],
            [
                'Welcome to https://danrahn.com!',
                this._divWrap('Welcome to <a href="https://danrahn.com">https:&#x2f;&#x2f;danrahn.com</a>!')
            ],
            [
                'Welcome to http://danrahn.com!',
                this._divWrap('Welcome to <a href="http://danrahn.com">http:&#x2f;&#x2f;danrahn.com</a>!')
            ],
            [
                'Welcome to file://danrahn.com!',
                this._divWrap('Welcome to <a href="file://danrahn.com">file:&#x2f;&#x2f;danrahn.com</a>!')
            ],
            [
                'Welcome to ftp://danrahn.com!',
                this._divWrap('Welcome to <a href="ftp://danrahn.com">ftp:&#x2f;&#x2f;danrahn.com</a>!')
            ],
            [
                'Welcome to ht://danrahn.com!',
                this._divWrap('Welcome to ht:&#x2f;&#x2f;<a href="https://danrahn.com">danrahn.com</a>!')
            ],
            [
                'Welcome to HTTTPS://danrahn.com!',
                this._divWrap('Welcome to HTTTPS:&#x2f;&#x2f;<a href="https://danrahn.com">danrahn.com</a>!')
            ],
            [
                '[link.com](danrahn.com)',
                this._divWrap('<a href="danrahn.com">link.com</a>')
            ],
            [
                'danrahn.com/plex',
                this._divWrap('<a href="https://danrahn.com/plex">danrahn.com&#x2f;plex</a>')
            ],
            [
                'danrahn.com/plex/',
                this._divWrap('<a href="https://danrahn.com/plex/">danrahn.com&#x2f;plex&#x2f;</a>')
            ],
            [
                'danrahn.com/plex/requests.php',
                this._divWrap('<a href="https://danrahn.com/plex/requests.php">danrahn.com&#x2f;plex&#x2f;requests.php</a>')
            ],
            [
                'danrahn.com!A',
                this._divWrap('<a href="https://danrahn.com">danrahn.com</a>!A')
            ],
            [
                'plex.danrahn.com',
                this._divWrap('<a href="https://plex.danrahn.com">plex.danrahn.com</a>')
            ],
            [
                '.danrahn.com',
                this._divWrap('.<a href="https://danrahn.com">danrahn.com</a>')
            ],
            [
                '--danrahn.com',
                this._divWrap('--<a href="https://danrahn.com">danrahn.com</a>')
            ]
        );

        return this._runSingleSuite(tests, 'Implicit Urls');
    }

    static testInline()
    {
        let tests = this._buildTests(
            ['`Inline Code`', this._divWrap('<code>Inline Code</code>')],
            ['\\`Inline Code`', this._divWrap('`Inline Code`')],
            ['``Inline ` Code``', this._divWrap('<code>Inline ` Code</code>')],
            ['`This isn\'t closed', this._divWrap('`This isn&#39;t closed')],
            ['`Hello _**++~~There~~++**_`', this._divWrap('<code>Hello _**++~~There~~++**_</code>')],
            ['`[Link](index.php)`', this._divWrap('<code>[Link](index.php)</code>')],
            // We allow single line continuations
            ['`Hello\nWorld`', this._divWrap('<code>Hello\nWorld</code>')],
            ['```Hello World\nHi```', this._divWrap('<code>Hello World\nHi</code>')],
            // But intentionally break things if we start with what we though was a valid block
            ['```Hello\nWorld```', this._divWrap('```Hello<br />World```')],
            // If we're escaping backticks and they are at the beginning or end of the string, strip the space...
            ['`` `Hello, World` ``', this._divWrap('<code>`Hello, World`</code>')],
            // But don't do anything if there are multiple spaces
            ['``  `Hello, World`  ``', this._divWrap('<code>  `Hello, World`  </code>')]
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
            ['__**BoldSquared**__', this._divWrap('<strong><strong>BoldSquared</strong></strong>')],
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

    static testSuperscript()
    {
        let tests = this._buildTests(
            ['A^B', this._divWrap('A<sup>B</sup>')],
            ['A^(B)', this._divWrap('A<sup>B</sup>')],
            ['A ^B', this._divWrap('A <sup>B</sup>')],
            ['A^ B', this._divWrap('A^ B')],
            ['A^( B)', this._divWrap('A<sup> B</sup>')],
            ['A\\^B', this._divWrap('A^B')],
            ['A^B C', this._divWrap('A<sup>B</sup> C')],
            ['A^(B C)', this._divWrap('A<sup>B C</sup>')],
            ['A^B^C', this._divWrap('A<sup>B<sup>C</sup></sup>')],
            ['A^^B', this._divWrap('A<sup><sup>B</sup></sup>')],
            ['A^B^CD', this._divWrap('A<sup>B<sup>CD</sup></sup>')],
            ['A^B^(C)D', this._divWrap('A<sup>B<sup>C</sup>D</sup>')],
            ['A^B^(C) D', this._divWrap('A<sup>B<sup>C</sup></sup> D')],
            ['A^(B C', this._divWrap('A<sup>(B</sup> C')],
            ['A^(B C\\)', this._divWrap('A<sup>(B</sup> C)')],
            ['A^(B(C)', this._divWrap('A<sup>(B(C)</sup>')],
            // Superscript breaks formatting if not properly scoped
            ['*A^B*', this._divWrap('*A<sup>B*</sup>')],
            ['*A^(B)*', this._divWrap('<em>A<sup>B</sup></em>')],
            ['*A^(**B)*', this._divWrap('<em>A<sup>**B</sup></em>')],
            ['*A^(**B**)*', this._divWrap('<em>A<sup><strong>B</strong></sup></em>')],
            // Inline elements can be nested
            ['A^**B**', this._divWrap('A<sup><strong>B</strong></sup>')],
            ['A^(~~_[B](url)_~~)', this._divWrap('A<sup><s><em><a href="url">B</a></em></s></sup>')]
        );

        return this._runSingleSuite(tests, 'Superscript Functionality');
    }

    static testSubscript()
    {
        let tests = this._buildTests(
            ['A~(B)', this._divWrap('A<sub>B</sub>')],
            ['A~B', this._divWrap('A~B')],
            ['A ~(B)', this._divWrap('A <sub>B</sub>')],
            ['A~ (B)', this._divWrap('A~ (B)')],
            ['A~( B)', this._divWrap('A<sub> B</sub>')],
            ['A\\~B', this._divWrap('A~B')],
            ['A~(B) C', this._divWrap('A<sub>B</sub> C')],
            ['A~(B C)', this._divWrap('A<sub>B C</sub>')],
            ['A~(B~(C))', this._divWrap('A<sub>B<sub>C</sub></sub>')],
            ['A~(~(B))', this._divWrap('A<sub><sub>B</sub></sub>')],
            ['A~(B~(CD))', this._divWrap('A<sub>B<sub>CD</sub></sub>')],
            ['A~(B~(C)D)', this._divWrap('A<sub>B<sub>C</sub>D</sub>')],
            ['A~(B~(C)) D', this._divWrap('A<sub>B<sub>C</sub></sub> D')],
            ['A~(B C', this._divWrap('A~(B C')],
            ['A~(B C\\)', this._divWrap('A~(B C)')],
            ['A~(B(C)', this._divWrap('A~(B(C)')],
            // Subscript can split formatting
            ['*A~(B*)', this._divWrap('*A<sub>B*</sub>')],
            ['*A~(B)*', this._divWrap('<em>A<sub>B</sub></em>')],
            ['*A~(**B)*', this._divWrap('<em>A<sub>**B</sub></em>')],
            ['*A~(**B**)*', this._divWrap('<em>A<sub><strong>B</strong></sub></em>')],
            // Inline elements can be nested
            ['A~(**B**)', this._divWrap('A<sub><strong>B</strong></sub>')],
            ['A~(~~_[B](url)_~~)', this._divWrap('A<sub><s><em><a href="url">B</a></em></s></sub>')]
        );

        return this._runSingleSuite(tests, 'Subscript Functionality');
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
            ['_*italicSquared*_', this._divWrap('<em><em>italicSquared</em></em>')],
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
            ['A\nB\nC', this._divWrap('A<br />B<br />C')],
            ['A<br>B', this._divWrap('A<br />B')],
            ['A<br/>B', this._divWrap('A<br />B')],
            ['A<br />B', this._divWrap('A<br />B')],
            ['A<br  />B', this._divWrap('A&lt;br  &#x2f;&gt;B')]

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
            ],
            [
                '| `` A ` | `` \\| ` B | C |\n| --- | --- |\n`D|E',
                '<table>' +
                    '<thead>' +
                        '<tr><td><code> A ` | </code> | ` B</td><td>C</td></tr>' +
                    '</thead>' +
                    '<tbody>' +
                        '<tr><td>`D</td><td>E</td></tr>' +
                    '</tbody>' +
                '</table>'
            ]
        );

        return this._runSingleSuite(tests, 'Basic Table Functionality');
    }

    static testUnorderedList()
    {
        let tests = this._buildTests(
            [
                '* A',
                '<ul><li>A</li></ul>',
            ],
            [
                '*A',
                this._divWrap('*A')
            ],
            [
                '*\nA',
                this._divWrap('*<br />A')
            ],
            [
                '* \nA',
                '<ul><li><br />A</li></ul>'
            ],
            [
                '* \nA\nB',
                '<ul><li><br />A<br />B</li></ul>'
            ],
            [
                '* A * B',
                '<ul><li>A * B</li></ul>'
            ],
            [
                '* A\n* B',
                '<ul><li>A<br /></li><li>B</li></ul>'
            ],
            [
                '* A\n * B',
                '<ul><li>A<br /></li><li>B</li></ul>'
            ],
            [
                '* A\n  * B',
                '<ul><li>A<br /><ul><li>B</li></ul></li></ul>'
            ],
            [
                '* A\n\n* B',
                '<ul><li>A<br /><br /></li><li>B</li></ul>'
            ],
            [
                '* A\n\n\n* B',
                '<ul><li>A<br /><br /></li></ul><ul><li>B</li></ul>'
            ],
            [
                '* A\n  * B\n* C',
                '<ul><li>A<br /><ul><li>B<br /></li></ul></li><li>C</li></ul>'
            ],
            [
                '* A\n\n  B',
                '<ul><li>A<br /><br />B</li></ul>'
            ],
            [
                '* A\n  * B\n\n    C',
                '<ul><li>A<br /><ul><li>B<br /><br />C</li></ul></li></ul>'
            ]
        );

        return this._runSingleSuite(tests, 'List Functionality');
    }

    static testOrderedList()
    {
        let tests = this._buildTests(
            [
                '1. A',
                '<ol><li>A</li></ol>',
            ],
            [
                '1.A',
                this._divWrap('1.A')
            ],
            [
                '1.\nA',
                this._divWrap('1.<br />A')
            ],
            [
                '1. \nA',
                '<ol><li><br />A</li></ol>'
            ],
            [
                '1. \nA\nB',
                '<ol><li><br />A<br />B</li></ol>'
            ],
            [
                '1. A 2. B',
                '<ol><li>A 2. B</li></ol>'
            ],
            [
                '1. A\n2. B',
                '<ol><li>A<br /></li><li>B</li></ol>'
            ],
            [
                '1. A\n 2. B',
                '<ol><li>A<br /></li><li>B</li></ol>'
            ],
            [
                '1. A\n  2. B',
                '<ol><li>A<br /><ol start="2"><li>B</li></ol></li></ol>'
            ],
            [
                '1. A\n\n2. B',
                '<ol><li>A<br /><br /></li><li>B</li></ol>'
            ],
            [
                '1. A\n\n\n2. B',
                '<ol><li>A<br /><br /></li></ol><ol start="2"><li>B</li></ol>'
            ],
            [
                '1. A\n  2. B\n3. C',
                '<ol><li>A<br /><ol start="2"><li>B<br /></li></ol></li><li>C</li></ol>'
            ],
            [
                '1. A\n\n  B',
                '<ol><li>A<br /><br />B</li></ol>'
            ],
            [
                '1. A\n  2. B\n\n    C',
                '<ol><li>A<br /><ol start="2"><li>B<br /><br />C</li></ol></li></ol>'
            ]
        );

        return this._runSingleSuite(tests, 'List Functionality');
    }

    static testBacktickCodeBlock()
    {
        return this._testTickTildeBlockCore('```');
    }

    static testTildeCodeBlock()
    {
        return this._testTickTildeBlockCore('~~~');
    }

    static testMixedBacktickTildeCodeBlock()
    {
        let tests = this._buildTests(
            [
                // Allow tilde within tick
                '```\n~~~\nA\n~~~\n```',
                `<pre>${this._preWrap('~~~', 'A', '~~~')}</pre>`
            ],
            [
                // Allow tick within tilde
                '~~~\n```\nA\n```\n~~~',
                `<pre>${this._preWrap('```', 'A', '```')}</pre>`
            ],
            [
                // We still think we're part of B, and our indentation is incorrect. This will be
                // interpreted as an inline code block
                '* A\n  * B\n  ```\n  C\n  ```',
                `<ul><li>A<br /><ul><li>B<br /><code>\n  C\n  </code></li></ul></li></ul>`
            ],
            [
                // Same as above, but with tildes. Since we don't have inline tilde blocks, they should remain as they are
                `* A\n  * B\n  ~~~\n  C\n  ~~~`,
                `<ul><li>A<br /><ul><li>B<br />~~~<br />C<br />~~~</li></ul></li></ul>`
            ]
        );

        return this._runSingleSuite(tests, 'Mixed tilde/backtick code blocks');
    }

    static _testTickTildeBlockCore(marker)
    {
        let tests = this._buildTests(
            [
                `${marker}\nA\n${marker}`,
                `<pre>${this._preWrap('A')}</pre>`
            ],
            [
                `${marker}\nA\nB\n${marker}`,
                `<pre>${this._preWrap('A', 'B')}</pre>`
            ],
            [
                `* ${marker}\n  A\n  ${marker}`,
                `<ul><li><pre>${this._preWrap('A')}</pre></li></ul>`
            ],
            [
                `* A\n  * B\n    ${marker}cpp\n    C\n    D\n    ${marker}`,
                `<ul><li>A<br /><ul><li>B<pre>${this._preWrap('C', 'D')}</pre></li></ul></li></ul>`
            ],
            [
                // The extra line break between B and the block means we can successfully be a part of A
                `* A\n  * B\n\n  ${marker}\n  C\n  ${marker}`,
                `<ul><li>A<br /><ul><li>B<br /><br /></li></ul><pre>${this._preWrap('C')}</pre></li></ul>`
            ],
            [
                // Start on the same line as the list
                `* ${marker}\n  A\n  ${marker}`,
                `<ul><li><pre>${this._preWrap('A')}</pre></li></ul>`
            ],
            [
                // Double nest same line
                `* 1. ${marker}\n    A\n    ${marker}`,
                `<ul><li><ol><li><pre>${this._preWrap('A')}</pre></li></ol></li></ul>`
            ],
            [
                // Bad spacing for double nesting
                `* 1. ${marker}\n  A\n  ${marker}`,
                `<ul><li><ol><li>${marker}<br />A<br />${marker}</li></ol></li></ul>`
            ],
            [
                // Allow for some leeway when dealing with indentation in lists
                `* \n    ${marker}\n    A\n    ${marker}`,
                `<ul><li><pre>${this._preWrap('  A')}</pre></li></ul>`
            ],
            [
                // Blockquote nest
                `>${marker}\n>A\n>${marker}`,
                `<blockquote><pre>${this._preWrap('A')}</pre></blockquote>`
            ],
            [
                // Not requiring space between blockquote and content means extra space added to nested code blocks
                `> ${marker}\n> A\n> ${marker}`,
                `<blockquote><pre>${this._preWrap(' A')}</pre></blockquote>`
            ],
            [
                // Can't change blockquote level
                `>${marker}\n>A\n>>${marker}`,
                `<blockquote>${marker}<br />A<br /><blockquote>${marker}</blockquote></blockquote>`
            ],
            [
                // But we can have a "nested" blockquote within the body of the code block
                `>${marker}\n>A\n>>${marker}\n>${marker}`,
                `<blockquote><pre>${this._preWrap('A', '&gt;' + marker)}</pre></blockquote>`
            ],
            [
                // Block + List nesting
                `1. > ${marker}\n>A\n  >${marker}`,
                `<ol><li><blockquote><pre>${this._preWrap('A')}</pre></blockquote></li></ol>`
            ],
            [
                // Block + List nesting. Since our direct parent is a blockquote, it takes precedence over any list indentation rules
                `* >${marker}\n>A\n>${marker}`,
                `<ul><li><blockquote><pre>${this._preWrap('A')}</pre></blockquote></li></ul>`
            ],
            [
                // Block + List nesting. Since our direct parent is a list, we need the proper (list + 2) indentation
                `> 1. ${marker}\n>   A\n>   ${marker}`,
                `<blockquote><ol><li><pre>${this._preWrap('A')}</pre></li></ol></blockquote>`
            ],
            [
                // Block + List nesting. Since our direct parent is a list, we need the proper (list + 2) indentation
                `> 1. ${marker}\n>  A\n>  ${marker}`,
                `<blockquote><ol><li>${marker}<br />A<br />${marker}</li></ol></blockquote>`
            ],
            [
                // Allow whitespace after blockquote nested inside of list
                `1. \n  > ${marker}\n  > A\n  > ${marker}`,
                `<ol><li><blockquote><pre>${this._preWrap(' A')}</pre></blockquote></li></ol>`
            ],
            [
                `${marker}\n  ${marker}\n${marker}`,
                `<pre>${this._preWrap('  ' + marker)}</pre>`
            ],
            [
                `${marker}\n ${marker}\n${marker}`,
                `<pre>${this._preWrap('')}</pre>${this._divWrap(marker)}`
            ],
            [
                '```C++\nA\n```',
                `<pre>${this._preWrap('A')}</pre>`
            ]
        );

        return this._runSingleSuite(tests, (marker == '```' ? 'Backtick' : 'Tilde') + ' code blocks');
    }

    static testIndentCodeBlock()
    {
        let tests = this._buildTests(
            [
                '    A',
                `<pre>${this._preWrap('A')}</pre>`
            ],
            [
                '     A',
                `<pre>${this._preWrap(' A')}</pre>`
            ],
            [
                '   A',
                this._divWrap('A')
            ],
            [
                '    A\n    B',
                `<pre>${this._preWrap('A', 'B')}</pre>`
            ],
            [
                '    A\n   B',
                `<pre>${this._preWrap('A')}</pre>${this._divWrap('B')}`
            ],
            [
                // Blank lines without indents are okay
                '    A\n\n    B',
                `<pre>${this._preWrap('A', '', 'B')}</pre>`
            ],
            // Lists
            [
                '*     A',
                `<ul><li><pre>${this._preWrap('A')}</pre></li></ul>`
            ],
            [
                '1.     A',
                `<ol><li><pre>${this._preWrap('A')}</pre></li></ol>`
            ],
            [
                '*    A',
                '<ul><li>   A</li></ul>'
            ],
            [
                // No break after li, before pre, probably a bug
                '* \n      A',
                `<ul><li><pre>${this._preWrap('A')}</pre></li></ul>`
            ],
            [
                '* \n       A',
                `<ul><li><pre>${this._preWrap(' A')}</pre></li></ul>`
            ],
            [
                '*     A\n      B',
                `<ul><li><pre>${this._preWrap('A', 'B')}</pre></li></ul>`
            ],
            [
                '* \n      A\n     B',
                `<ul><li><pre>${this._preWrap('A')}</pre>B</li></ul>`
            ],
            [
                '* *     A',
                `<ul><li><ul><li><pre>${this._preWrap('A')}</pre></li></ul></li></ul>`
            ],
            [
                '* \n  *     A',
                `<ul><li><br /><ul><li><pre>${this._preWrap('A')}</pre></li></ul></li></ul>`
            ],
            [
                '* \n  * \n    * \n          A',
                `<ul><li><br /><ul><li><br /><ul><li><pre>${this._preWrap('A')}</pre></li></ul></li></ul></li></ul>`
            ],
            // Quotes
            [
                '>    A',
                `<blockquote><pre>${this._preWrap('A')}</pre></blockquote>`
            ],
            [
                '>    A\n>    B',
                `<blockquote><pre>${this._preWrap('A', 'B')}</pre></blockquote>`
            ],
            [
                '>     A\n>   B',
                `<blockquote><pre>${this._preWrap(' A')}</pre>B</blockquote>`
            ],
            [
                `>    A\n\n>    B`,
                `<blockquote><pre>${this._preWrap('A')}</pre></blockquote><blockquote><pre>${this._preWrap('B')}</pre></blockquote>`
            ],
            [
                '>>    A\n>    B',
                `<blockquote><blockquote><pre>${this._preWrap('A')}</pre></blockquote><pre>${this._preWrap('B')}</pre></blockquote>`
            ],
            [
                '>    A\n>>    B',
                `<blockquote><pre>${this._preWrap('A')}</pre><blockquote><pre>${this._preWrap('B')}</pre></blockquote></blockquote>`
            ],
            // Mixed list + quote
            [
                '> *     A',
                `<blockquote><ul><li><pre>${this._preWrap('A')}</pre></li></ul></blockquote>`
            ],
            [
                '* >    A',
                `<ul><li><blockquote><pre>${this._preWrap('A')}</pre></blockquote></li></ul>`
            ],
            [
                '* \n>\n>    A',
                `<ul><li><blockquote><br /><pre>${this._preWrap('A')}</pre></blockquote></li></ul>`
            ],
            [
                '1. \n  > A\n  >    B\n  >    C\n  *     D',
                `<ol>` +
                    `<li>` +
                        `<blockquote>` +
                            `A<br />` +
                            `<pre>${this._preWrap('B', 'C')}</pre>` +
                        `</blockquote>` +
                        `<ul>` +
                            `<li>` +
                                `<pre>${this._preWrap('D')}</pre>` +
                            `</li>` +
                        `</ul>` +
                    `</li>` +
                `</ol>`
            ]

        );

        return this._runSingleSuite(tests, 'Indented code blocks');
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

    /// <summary>
    /// Tests various BlockQuote and (Un)OrderedList nesting possibilities
    /// All these cases are issues that have (hopefully) been fixed
    /// </summary>
    static testQuoteListNest()
    {
        let tests = this._buildTests(
            [
                '> 1. ListItem1\n> 2. ListItem2',
                '<blockquote><ol><li>ListItem1</li><li>ListItem2</li></ol></blockquote>'
            ],
            [
                '> 1. ListItem1\n> 1. ListItem2',
                '<blockquote><ol><li>ListItem1</li><li>ListItem2</li></ol></blockquote>'
            ],
            [
                '> * A\n>   1. B\n>   2. C\n> * D',
                '<blockquote><ul><li>A<br /><ol><li>B</li><li>C</li></ol></li><li>D</li></ul></blockquote>'
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
                '<blockquote><ol><li><blockquote><ul><li>A</li></ul></blockquote></li></ol></blockquote>'
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
            ],
            [
                '**->** A',
                '<div class="mdDiv"><strong>-&gt;</strong> A</div>'
            ],
            [
                '* \\*A\\*',
                '<ul><li>*A*</li></ul>'
            ],
            [
                '```\nA ```\n```',
                '<pre>' + this._preWrap('A ```') + '</pre>'
            ],
            [
                '> ```\n\n> ```',
                '<blockquote>```</blockquote><blockquote>```</blockquote>'
            ],
            [
                '> ```\n>\n> ```',
                `<blockquote><pre>${this._preWrap('')}</pre></blockquote>`
            ],
            [
                '_**_A_**_',
                this._divWrap('<em><strong><em>A</em></strong></em>')
            ],
            [
                '++_++_A_++_++',
                this._divWrap('<ins><em><ins><em>A</em></ins></em></ins>')
            ],
            [
                '**`` ** ``**',
                this._divWrap('<strong><code> ** </code></strong>')
            ],
            [
                // Need to properly account for inline code runs within tables
                '| `` A ` | `` \\| ` B ` | C |\n| --- | --- |',
                '<table><thead><tr><td><code> A ` | </code> | <code> B </code></td><td>C</td></tr></thead><tbody></tbody></table>'
            ],
            [
                // URLs nested inside of super/subscript
                'A^[B](url)',
                this._divWrap('A<sup><a href="url">B</a></sup>')
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

        tests.forEach(function(test)
        {
            if (MarkdownTestSuite.testCache)
            {
                MarkdownTestSuite._testCache(test, colors, stats);
            }
            else
            {
                MarkdownTestSuite._validateTest(test, new Markdown().parse(test.input), colors, stats);
            }
        });

        g_logLevel = logSav;
        logInfo(`Ran ${stats.passed + stats.failed} Tests: Passed: ${stats.passed}  -  Failed: ${stats.failed}`);
        return stats;
    }

    /// <summary>
    /// Tests the Markdown caching mechanism by consecutively parsing each test
    /// character by character until finally parsing the entire input, then
    /// comparing it against the expected output
    /// </summary>
    static _testCache(test, colors, stats)
    {
        let cacheSav = localStorage.getItem('mdCache');
        localStorage.setItem('mdCache', 1);
        let md = new Markdown();

        // Enter each character one by one, parsing after every step
        let run = '';
        for (let i = 0; i < test.input.length - 1; ++i)
        {
            run += test.input[i];
            md.parse(run);
        }

        let result = md.parse(test.input);
        MarkdownTestSuite._validateTest(test, result, colors, stats);
        localStorage.setItem('mdCache', cacheSav);
    }

    /// <summary>
    /// Compares the given test result with the expected result, printing
    /// out a message indicating whether the test passed or failed
    /// </summary>
    static _validateTest(test, result, colors, stats)
    {
        let displayInput = MarkdownTestSuite._escapeTestString(test.input);
        let displayExpected = MarkdownTestSuite._escapeTestString(test.expected);
        if (result == test.expected)
        {
            let logString = `    %cPassed!%c [%c${displayInput}%c]%c => %c[%c${displayExpected}%c]`;
            logFormattedText(LOG.Info, logString, ...colors.success);
            ++stats.passed;
        }
        else
        {
            let fixedIndent = ' '.repeat(36); // Indent from the consolelog header
            let logString = `   %cFAIL!\n` +
                `${fixedIndent}%cInput:    %c[%c${displayInput}%c]%c\n` +
                `${fixedIndent}Expected: %c[%c${MarkdownTestSuite._escapeTestString(displayExpected)}%c]%c\n` +
                `${fixedIndent}Actual:   %c[%c${MarkdownTestSuite._escapeTestString(result)}%c]`;
            logFormattedText(LOG.Warn, logString, ...colors.failure);
            ++stats.failed;
        }
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

    /// <summary>
    /// Helper to add the line number span to code block tests
    /// </summary>
    static _preWrap(...lines)
    {
        let result = '';
        lines.forEach(function(line, lineNumber)
        {
            result += `<span class="codeLineNumber">${lineNumber + 1}</span>${line}\n`;
        });

        return result;
    }
}
