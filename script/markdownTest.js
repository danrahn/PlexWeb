/* exported testMarkdown, MarkdownTestSuite */

// Markdown files are the only ones that prefer single-quotes over double.
/* eslint quotes: ["error", "single", { "avoidEscape" : true, "allowTemplateLiterals" : true }] */
/* eslint-disable class-methods-use-this */

// The only methods (currently) over the maximum are just lists of relevant tests
/* eslint-disable max-lines-per-function */

class MarkdownTestSuite
{
    constructor()
    {
        this.host = window.location.hostname;
        this.sld = this.host.substring(0, this.host.lastIndexOf('.'));
        this.tld = this.host.substring(this.sld.length);
        this.alwaysExternal = false;
        if (this.sld.length == 0 || !isNaN(parseFloat(this.tld)))
        {
            // Running from a tld-less host (e.g. localhost or a direct IP)? Get the tests to
            // pass, but we'll lose some target="_blank" test coverage
            Log.warn(`Tests are being run from a tld-less host (${window.location.hostname}). Some coverage may be missing`);
            this.sld = 'hostOverride';
            this.tld = '.com';
            this.host = this.sld + this.tld;
            this.alwaysExternal = true;
        }
    }

    /// <summary>
    /// Runs all available tests
    /// </summary>
    runSuite(testCache = false)
    {
        this.testCache = testCache;
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
        addResult(this.testImage());
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
        addResult(this.testHTMLComment());
        addResult(this.testHtmlSpan());
        addResult(this.testHtmlStyle());
        addResult(this.testElementStyle());

        addResult(this.testMixed());
        addResult(this.testQuoteListNest());

        addResult(this.testBugFixes());

        Log.info('');
        let totalTests = overallResults.passed + overallResults.failed;
        Log.info(`Passed ${overallResults.passed} of ${totalTests} tests (${((overallResults.passed / totalTests) * 100).toFixed(2)}%)`);
        return overallResults;
    }

    testHeaders()
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
            [
                `# [Header With Link](https://${this.host})`,
                `<h1 id="header-with-link">${this._href('https://' + this.host, 'Header With Link')}</h1>`
            ],
            ['1. # Header in list', '<ol><li><h1 id="header-in-list">Header in list</h1></li></ol>'],
            ['* # Header in list', '<ul><li><h1 id="header-in-list">Header in list</h1></li></ul>'],
            ['> # Header in quote', '<blockquote><h1 id="header-in-quote">Header in quote</h1></blockquote>'],
            ['* > # Header in list quote', '<ul><li><blockquote><h1 id="header-in-list-quote">Header in list quote</h1></blockquote></li></ul>'],
        );

        return this._runSingleSuite(tests, 'Basic Header Functionality');
    }

    testUrl()
    {
        let tests = this._buildTests(
            [
                // Domains should have https prepended if a protocol is not specified
                `[Link](${this.host})`,
                this._divWrap(this._href(`https://${this.host}`, 'Link'))
            ],
            [
                // And the protocol should be left alone otherwise
                `[Add some text here](http://${this.host})`,
                this._divWrap(this._href(`http://${this.host}`, 'Add some text here'))
            ],
            [
                `[Link[](${this.host})`,
                this._divWrap(`[Link${this._href(`https://${this.host}`, '')}`)
            ],
            [
                // External links open in a new window
                '[Outer[Inner](inner.com)](outer.com)',
                this._divWrap(this._href('https://outer.com', `Outer${this._href('https://inner.com', 'Inner', true)}`, true))
            ],
            [
                // Different protocols/ports should still open internally
                `[Link](http://${this.host}:32400)`,
                this._divWrap(this._href(`http://${this.host}:32400`, 'Link'))
            ],
            [
                // Subdomains should open internally as well
                `[Link](plex.${this.host}/r/100)`,
                this._divWrap(this._href(`https://plex.${this.host}/r/100`, 'Link'))
            ],
            [
                // danrahn.plex.com is not a subset of danrahn.com
                `[Link](${this.sld}.plex${this.tld})`,
                this._divWrap(this._href(`https://${this.sld}.plex${this.tld}`, 'Link', true))
            ],
            [
                // Even without a protocol, we should figure out whether something is an external or relative reference
                '[Github](github.com)',
                this._divWrap(this._href('https://github.com', 'Github', true))
            ],
            [
                `[More Github](github.com/${this.sld})`,
                this._divWrap(this._href(`https://github.com/${this.sld}`, 'More Github', true))
            ],
            [
                `[GH3](github.com/${this.host}/plex/index.php)`,
                this._divWrap(this._href(`https://github.com/${this.host}/plex/index.php`, 'GH3', true))
            ],
            [
                '[GH4](github.com:443)',
                this._divWrap(this._href('https://github.com:443', 'GH4', true))
            ],
            [
                `[GH5](github.com:443/${this.sld})`,
                this._divWrap(this._href(`https://github.com:443/${this.sld}`, 'GH5', true))
            ]
        );

        // We keep invalid links internal, so override our override (ugh.)
        let overrideSav = this.alwaysExternal;
        this.alwaysExternal = false;
        tests.push(...this._buildTests(
            [
                // Don't encode href
                '[https://backwards.com](Uh oh!)',
                this._divWrap(this._href('Uh oh!', 'https:&#x2f;&#x2f;backwards.com'))
            ],
            [
                '[https://backwards.com](hello%20world)',
                this._divWrap(this._href('hello%20world', 'https:&#x2f;&#x2f;backwards.com'))
            ]
        ));
        this.alwaysExternal = overrideSav;

        return this._runSingleSuite(tests, 'Basic Url Functionality');
    }

    testReferenceUrl()
    {
        // Real sparse testing. Needs to be expanded
        let tests = this._buildTests(
            [
                '[A][1]\n[1]: b.com',
                this._divWrap(`${this._href('https://b.com', 'A', true)}<br /><!-- [1]: b.com -->`)
            ],
            [
                '[1]: b.com\n[A][1]',
                this._divWrap(`<!-- [1]: b.com -->${this._href('https://b.com', 'A', true)}`)
            ]
        );

        return this._runSingleSuite(tests, 'Reference Urls');
    }

    testImplicitUrl()
    {
        let tests = this._buildTests(
            [
                this.host,
                this._divWrap(this._href(`https://${this.host}`, this.host))
            ],
            [
                `Welcome to ${this.host}!`,
                this._divWrap(`Welcome to ${this._href(`https://${this.host}`, this.host)}!`)
            ],
            [
                `Welcome to ${this.host}.`,
                this._divWrap(`Welcome to ${this._href(`https://${this.host}`, this.host)}.`)
            ],
            [
                `Welcome to ${this.sld}.org!`,
                this._divWrap(`Welcome to ${this._href(`https://${this.sld}.org`, `${this.sld}.org`, true)}!`)
            ],
            [
                `Welcome to ${this.sld}.net!`,
                this._divWrap(`Welcome to ${this._href(`https://${this.sld}.net`, `${this.sld}.net`, true)}!`)
            ],
            [
                `Welcome to ${this.sld}.de!`,
                this._divWrap(`Welcome to ${this._href(`https://${this.sld}.de`, `${this.sld}.de`, true)}!`)
            ],
            [
                `Welcome to ${this.sld}.bad!`,
                this._divWrap(`Welcome to ${this.sld}.bad!`)
            ],
            [
                `Welcome to https://${this.host}!`,
                this._divWrap(`Welcome to ${this._href(`https://${this.host}`, `https:&#x2f;&#x2f;${this.host}`)}!`)
            ],
            [
                `Welcome to http://${this.host}!`,
                this._divWrap(`Welcome to ${this._href(`http://${this.host}`, `http:&#x2f;&#x2f;${this.host}`)}!`)
            ],
            [
                `Welcome to ftp://${this.host}!`,
                this._divWrap(`Welcome to ${this._href(`ftp://${this.host}`, `ftp:&#x2f;&#x2f;${this.host}`)}!`)
            ],
            [
                `Welcome to ht://${this.host}!`,
                this._divWrap(`Welcome to ht:&#x2f;&#x2f;${this._href(`https://${this.host}`, this.host)}!`)
            ],
            [
                `Welcome to HTTTPS://${this.host}!`,
                this._divWrap(`Welcome to HTTTPS:&#x2f;&#x2f;${this._href(`https://${this.host}`, this.host)}!`)
            ],
            [
                // Don't parse links that are part of explicit URLs
                `[link.com](${this.host})`,
                this._divWrap(this._href(`https://${this.host}`, 'link.com'))
            ],
            [
                `${this.host}/plex`,
                this._divWrap(this._href(`https://${this.host}/plex`, `${this.host}&#x2f;plex`))
            ],
            [
                `${this.host}/plex/`,
                this._divWrap(this._href(`https://${this.host}/plex/`, `${this.host}&#x2f;plex&#x2f;`))
            ],
            [
                `${this.host}/plex/requests.php`,
                this._divWrap(this._href(`https://${this.host}/plex/requests.php`, `${this.host}&#x2f;plex&#x2f;requests.php`))
            ],
            [
                `${this.host}!A`,
                this._divWrap(`${this._href(`https://${this.host}`, `${this.host}`)}!A`)
            ],
            [
                `plex.${this.host}`,
                this._divWrap(this._href(`https://plex.${this.host}`, `plex.${this.host}`))
            ],
            [
                `http://plex.${this.host}/r/100`,
                this._divWrap(this._href(`http://plex.${this.host}/r/100`, `http:&#x2f;&#x2f;plex.${this.host}&#x2f;r&#x2f;100`))
            ],
            [
                `.${this.host}`,
                this._divWrap('.' + this._href(`https://${this.host}`, `${this.host}`))
            ],
            [
                `--${this.host}`,
                this._divWrap('--' + this._href(`https://${this.host}`, `${this.host}`))
            ],
            [
                'example.com',
                this._divWrap(this._href('https://example.com', 'example.com', true))
            ],
            [
                'danrahn.plex.com',
                this._divWrap(this._href('https://danrahn.plex.com', 'danrahn.plex.com', true))
            ],
            [
                `${this.host}:32400`,
                this._divWrap(this._href(`https://${this.host}:32400`, `${this.host}:32400`))
            ],
            [
                `https://${this.host}:32400`,
                this._divWrap(this._href(`https://${this.host}:32400`, `https:&#x2f;&#x2f;${this.host}:32400`))
            ],
            [
                'github.com:443',
                this._divWrap(this._href('https://github.com:443', 'github.com:443', true))
            ],
            [
                `${this.host}:`,
                this._divWrap(this._href(`https://${this.host}`, this.host) + ':')
            ],
            [
                `${this.host}:324000`,
                this._divWrap(this._href(`https://${this.host}`, this.host) + ':324000')
            ],
            [
                `${this.host}:65535`,
                this._divWrap(this._href(`https://${this.host}:65535`, `${this.host}:65535`))
            ],
            [
                `${this.host}:65536`,
                this._divWrap(this._href(`https://${this.host}`, this.host) + ':65536')
            ]
        );

        return this._runSingleSuite(tests, 'Implicit Urls');
    }

    testImage()
    {
        let tests = this._buildTests(
            [
                '![](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg">')
            ],
            [
                '![Alt](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt">')
            ],
            [
                `![Alt](${this.host}/plex/poster/movieDefault.svg)`,
                this._divWrap(`<img src="https://${this.host}/plex/poster/movieDefault.svg" alt="Alt">`)
            ],
            [
                `![Alt](${this.host}:443/plex/poster/movieDefault.svg)`,
                this._divWrap(`<img src="https://${this.host}:443/plex/poster/movieDefault.svg" alt="Alt">`)
            ],
            [
                '![Alt2](external.com/image.png)',
                this._divWrap('<img src="https://external.com/image.png" alt="Alt2">')
            ],
            [
                '![w=300](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" width="300px">')
            ],
            [
                '![h=300](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" height="300px">')
            ],
            [
                '![w=300,h=400](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" width="300px" height="400px">')
            ],
            [
                '![Alt Text w=300](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text" width="300px">')
            ],
            [
                '![Alt Text h=300](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text" height="300px">')
            ],
            [
                '![Alt Text w=300,h=400](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text" width="300px" height="400px">')
            ],
            [
                '![Alt Text w=50%](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text" width="50%">')
            ],
            [
                '![Alt Text h=50%](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text" height="50%">')
            ],
            [
                '![Alt Text w=20%,h=50%](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text" width="20%" height="50%">')
            ],
            [
                '![Alt Text w=200,h=50%](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text" width="200px" height="50%">')
            ],
            [
                '![Alt Text w=20%,h=500](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text" width="20%" height="500px">')
            ],
            [
                // Width has to come before height
                '![Alt Text h=20%,w=500](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text h=20%,w=500">')
            ],
            [
                '![Alt Text w=300 ](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text w=300 ">')
            ],
            [
                '![Alt Text w=300,h=400 ](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text w=300,h=400 ">')
            ],
            [
                '![Alt Text w=300 h=400](poster/movieDefault.svg)',
                this._divWrap('<img src="poster/movieDefault.svg" alt="Alt Text w=300" height="400px">')
            ]
        );

        return this._runSingleSuite(tests, 'Images');
    }

    testInline()
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

    testBold()
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

    testStrikethrough()
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

    testUnderline()
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

    testSuperscript()
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

    testSubscript()
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

    testItalic()
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

    testHr()
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

    testBr()
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

    testTable()
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

    testUnorderedList()
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

    testOrderedList()
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

    testBacktickCodeBlock()
    {
        return this._testTickTildeBlockCore('```');
    }

    testTildeCodeBlock()
    {
        return this._testTickTildeBlockCore('~~~');
    }

    testMixedBacktickTildeCodeBlock()
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

    _testTickTildeBlockCore(marker)
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

    testIndentCodeBlock()
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

    testHTMLComment()
    {
        let tests = this._buildTests(
            [
                '<!-- Comment Test -->',
                this._divWrap('<!-- Comment Test -->')
            ],
            [
                'Hello, <!-- Comment Test -->There',
                this._divWrap('Hello, <!-- Comment Test -->There')
            ],
            [
                '\\<!-- Comment Test -->',
                this._divWrap('&lt;!-- Comment Test --&gt;')
            ]
        );

        return this._runSingleSuite(tests, 'HTML Comments');
    }

    testHtmlSpan()
    {
        let tests = this._buildTests(
            [
                '<span>Hello</span>',
                this._divWrap('<span>Hello</span>')
            ],
            [
                'Hello, <span>World</span>',
                this._divWrap('Hello, <span>World</span>')
            ],
            [
                'Hello, <span>Worl</span>d',
                this._divWrap('Hello, <span>Worl</span>d')
            ],
            [
                '<span style="color:red;">Hello</span>',
                this._divWrap('<span style="color:red;">Hello</span>')
            ],
            [
                '<span style="color:red">Hello</span>',
                this._divWrap('<span style="color:red;">Hello</span>')
            ],
            [
                '<span style="color:red;background-color:blue">Hello</span>',
                this._divWrap('<span style="color:red;background-color:blue;">Hello</span>')
            ],
            [
                '<span style="background-color:blue;' +
                    'color:red;font-family:serif;font-style:bold;letter-spacing:5px;' +
                    'text-decoration:underline overline;word-spacing:10px">Hello</span>',
                this._divWrap('<span style="background-color:blue;' +
                    'color:red;font-family:serif;font-style:bold;letter-spacing:5px;' +
                    'text-decoration:underline overline;word-spacing:10px;">Hello</span>')
            ],
            [
                '<span style="letter-spacing:200px">Hello</span>',
                this._divWrap('<span style="letter-spacing:100px;">Hello</span>')
            ],
            [
                '<span style="letter-spacing:200pt">Hello</span>',
                this._divWrap('<span style="letter-spacing:75pt;">Hello</span>')
            ],
            [
                '<span style="letter-spacing:200em">Hello</span>',
                this._divWrap('<span style="letter-spacing:7em;">Hello</span>')
            ],
            [
                '<span style="letter-spacing:-200px">Hello</span>',
                this._divWrap('<span style="letter-spacing:-7px;">Hello</span>')
            ],
            [
                '<span style="letter-spacing:-200pt">Hello</span>',
                this._divWrap('<span style="letter-spacing:-5pt;">Hello</span>')
            ],
            [
                '<span style="letter-spacing:-200em">Hello</span>',
                this._divWrap('<span style="letter-spacing:-1em;">Hello</span>')
            ],
            [
                '<span style="letter-spacing:20.0px">Hello</span>',
                this._divWrap('<span style="letter-spacing:20px;">Hello</span>')
            ],
            [
                '<span style="letter-spacing:20.1px">Hello</span>',
                this._divWrap('<span style="letter-spacing:20.1px;">Hello</span>')
            ],
            [
                '<span style="letter-spacing:.5em">Hello</span>',
                this._divWrap('<span style="letter-spacing:0.5em;">Hello</span>')
            ],
            [
                '<span style="font-size:200pt">Hello</span>',
                this._divWrap('<span style="font-size:33pt;">Hello</span>')
            ],
            [
                '<span style="background-image:example.jpg">Hello</span>',
                this._divWrap('<span>Hello</span>')
            ],
            [
                '<span style="color:red;" width="100px">Hello</span>',
                this._divWrap('<span style="color:red;">Hello</span>')
            ],
            [
                '<span width="100px" style="color:red;">Hello</span>',
                this._divWrap('<span style="color:red;">Hello</span>')
            ],
            [
                '\\<span>Hello</span>',
                this._divWrap('&lt;span&gt;Hello&lt;&#x2f;span&gt;')
            ],
            [
                '<span>Hello\\</span>',
                this._divWrap('&lt;span&gt;Hello&lt;&#x2f;span&gt;')
            ],
            [
                '<span\\>Hello</span>',
                this._divWrap('&lt;span&gt;Hello&lt;&#x2f;span&gt;')
            ],
            [
                '<span>Hello\\</span></span>',
                this._divWrap('<span>Hello&lt;&#x2f;span&gt;</span>')
            ],
            // Begin nested/multiple span tests
            [
                '<span>A</span>B<span>C</span>',
                this._divWrap('<span>A</span>B<span>C</span>')
            ],
            [
                '<span>A<span>B</span></span>',
                this._divWrap('<span>A<span>B</span></span>')
            ],
            [
                '<span>A<span>B</span>C<span>D</span></span>',
                this._divWrap('<span>A<span>B</span>C<span>D</span></span>')
            ],
            [
                '<span style="color:red">A<span style="color:green">B</span><span style="color:blue">C</span></span>',
                this._divWrap('<span style="color:red;">A<span style="color:green;">B</span><span style="color:blue;">C</span></span>')
            ],
            [
                '<span><span><span>A</span>B</span>C</span>',
                this._divWrap('<span><span><span>A</span>B</span>C</span>')
            ],
            [
                '<span>A<span>B</span>',
                this._divWrap('&lt;span&gt;A<span>B</span>')
            ],
            [
                '<span>A<span>B</span>\\</span>',
                this._divWrap('&lt;span&gt;A<span>B</span>&lt;&#x2f;span&gt;')
            ],
            [
                '<span>A<span>B\\</span></span>',
                this._divWrap('&lt;span&gt;A<span>B&lt;&#x2f;span&gt;</span>')
            ],
            [
                '<span>A\\<span>B</span></span>',
                this._divWrap('<span>A&lt;span&gt;B</span>&lt;&#x2f;span&gt;')
            ]
        );

        return this._runSingleSuite(tests, 'HTML Spans');
    }

    testHtmlStyle()
    {
        let tests = this._buildTests(
            [
                '<span class="header">A</span>\n' +
                '<style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '}\n' +
                '</style>',

                '<span style="color:red;">A</span>' +
                '<!-- <style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '}\n' +
                '</style> -->'
            ],
            [
                '<span class="header" style="color:blue">A</span>\n' +
                '<style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '}\n' +
                '</style>',

                '<span style="color:blue;">A</span>' +
                '<!-- <style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '}\n' +
                '</style> -->'
            ],
            [
                '<span class="header" style="color:blue">A</span>\n' +
                '<style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '  background-color : green;\n' +
                '}\n' +
                '</style>',

                '<span style="color:blue;background-color:green;">A</span>' +
                '<!-- <style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '  background-color : green;\n' +
                '}\n' +
                '</style> -->'
            ],
            [
                '<span class="header2">A</span>\n' +
                '<style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '}\n' +
                '</style>',

                '<span>A</span>' +
                '<!-- <style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '}\n' +
                '</style> -->'
            ],
            [
                '<span class="header">A</span>\n' +
                '<style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '}\n' +
                '</style>\n' +
                '<style>\n' +
                '.header {\n' +
                '  color : blue;\n' +
                '}\n' +
                '</style>',

                '<span style="color:blue;">A</span>' +
                '<!-- <style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '}\n' +
                '</style> -->' +
                '<!-- <style>\n' +
                '.header {\n' +
                '  color : blue;\n' +
                '}\n' +
                '</style> -->'
            ],
            [
                '<span class="HEADER">A</span>\n' +
                '<style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '}\n' +
                '</style>',

                '<span style="color:red;">A</span>' +
                '<!-- <style>\n' +
                '.header {\n' +
                '  color : red;\n' +
                '}\n' +
                '</style> -->'
            ],
            [
                '<style>\n.a{\ncolor:blue;\n}\n.b{\ncolor:red;\n}\n</style>\n' +
                '<span class="a b">c</span>',

                '<!-- <style>\n.a{\ncolor:blue;\n}\n.b{\ncolor:red;\n}\n</style> -->' +
                this._divWrap('<span style="color:red;">c</span>')
            ],
            [
                '<style>\n.b{\ncolor:red;\n}\n.a{\ncolor:blue;\n}\n</style>\n' +
                '<span class="a b">c</span>',

                '<!-- <style>\n.b{\ncolor:red;\n}\n.a{\ncolor:blue;\n}\n</style> -->' +
                this._divWrap('<span style="color:blue;">c</span>')
            ],
            [
                '<style>\n.a{\ncolor:blue;\n}\n.b{\ncolor:red;\n}\n</style>\n' +
                '<span class="a b" style="color:green">c</span>',

                '<!-- <style>\n.a{\ncolor:blue;\n}\n.b{\ncolor:red;\n}\n</style> -->' +
                this._divWrap('<span style="color:green;">c</span>')
            ],
            [
                '<style>\n' +
                '.header {\n' +
                '  word-spacing: 10px;\n' +
                '  letter-spacing: 5px;\n' +
                '  color: white;\n' +
                '}\n' +
                '.error {\n' +
                '  color: #D15141;\n' +
                '}\n' +
                '</style>\n' +
                '# <span class="error header">Header</span>',

                '<!-- <style>\n' +
                '.header {\n' +
                '  word-spacing: 10px;\n' +
                '  letter-spacing: 5px;\n' +
                '  color: white;\n' +
                '}\n' +
                '.error {\n' +
                '  color: #D15141;\n' +
                '}\n' +
                '</style> -->' +
                '<h1 id="header"><span style="color:#D15141;letter-spacing:5px;word-spacing:10px;">Header</span></h1>'
            ],
            [
                '<style>\n.a{\ncolor:blue!important;\n}\n</style>\n<span class="a" style="color:red">A</span>',

                '<!-- <style>\n.a{\ncolor:blue!important;\n}\n</style> -->' +
                this._divWrap('<span style="color:blue;">A</span>')
            ],
            [
                '<style>\n.a{\ncolor:blue!important;\n}\n.b{\ncolor:red;\n}\n</style>\n' +
                '<span class="a b">A</span>',

                '<!-- <style>\n.a{\ncolor:blue!important;\n}\n.b{\ncolor:red;\n}\n</style> -->' +
                this._divWrap('<span style="color:blue;">A</span>')
            ],
            [
                '<style>\n.a{\ncolor:blue!important;\n}\n.b{\ncolor:red !important;\n}\n</style>\n' +
                '<span class="a b">A</span>',

                '<!-- <style>\n.a{\ncolor:blue!important;\n}\n.b{\ncolor:red !important;\n}\n</style> -->' +
                this._divWrap('<span style="color:red;">A</span>')
            ],
            [
                '<style>\n.a{\ncolor:blue!important;\n}\n.b{\ncolor:red !important;\n}\n</style>\n' +
                '<span class="a b" style="color:green !important">A</span>',

                '<!-- <style>\n.a{\ncolor:blue!important;\n}\n.b{\ncolor:red !important;\n}\n</style> -->' +
                this._divWrap('<span style="color:green;">A</span>')
            ],
            [
                '<style>\n.a{\ncolor:blue!important;\n}\n.a{\ncolor:red;\n}\n</style>\n' +
                '<span class="a">A</span>',

                '<!-- <style>\n.a{\ncolor:blue!important;\n}\n.a{\ncolor:red;\n}\n</style> -->' +
                this._divWrap('<span style="color:blue;">A</span>')
            ],
            [
                '<style>\n.a{\nfont-size:400px;\n}\n</style>\n' +
                '<span class="a">A</span>',

                '<!-- <style>\n.a{\nfont-size:400px;\n}\n</style> -->' +
                this._divWrap('<span style="font-size:44px;">A</span>')
            ]
        );
        return this._runSingleSuite(tests, 'HTML Style');
    }

    testElementStyle()
    {
        let tests = this._buildTests(
            [
                '<style>\nh1{\ncolor:blue;\n}\n</style>\n# A\n\n# B',
                '<!-- <style>\nh1{\ncolor:blue;\n}\n</style> -->' +
                '<h1 id="a" style="color:blue;">A</h1><h1 id="b" style="color:blue;">B</h1>'
            ],
            [
                '<style>\ncode{\nletter-spacing:3px;\n}\n</style>\n`A`',
                '<!-- <style>\ncode{\nletter-spacing:3px;\n}\n</style> -->' +
                this._divWrap('<code style="letter-spacing:3px;">A</code>')
            ],
            [
                '<style>\ncode{\nletter-spacing:3px!important;\n}\ncode{\nletter-spacing:4px;\n}\n</style>\n`A`',
                '<!-- <style>\ncode{\nletter-spacing:3px!important;\n}\ncode{\nletter-spacing:4px;\n}\n</style> -->' +
                this._divWrap('<code style="letter-spacing:3px;">A</code>')
            ],
            [
                '<style>\nh1,h2,h3,.header{\ncolor:red;\n}\n</style>\n# A\n## B\n### C\n<span class="header">D</span>',
                '<!-- <style>\nh1,h2,h3,.header{\ncolor:red;\n}\n</style> -->' +
                '<h1 id="a" style="color:red;">A</h1>' +
                '<h2 id="b" style="color:red;">B</h2>' +
                '<h3 id="c" style="color:red;">C</h3>' +
                this._divWrap('<span style="color:red;">D</span>')
            ]
        );

        return this._runSingleSuite(tests, 'Non-class-based HTML style');
    }

    testMixed()
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
    testQuoteListNest()
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
    testBugFixes()
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
            ],
            [
                '^(a\n\n)',
                this._divWrap('<sup>(a</sup>') + this._divWrap(')')
            ],
            [
                // Make sure the right offsets are used when determining whether a pipe is escaped
                '1\n| `` A ` | `` \\| ` B ` | C |\n| --- | --- |',
                '1<table><thead><tr><td><code> A ` | </code> | <code> B </code></td><td>C</td></tr></thead><tbody></tbody></table>'
            ],
            [
                '< `<!--` `-->`',
                this._divWrap('&lt; <code>&lt;!--</code> <code>--&gt;</code>')
            ],
            [
                '<style>\n' +
                '-->\n' +
                '<style>\n' +
                'h1 {\n' +
                '  color: blue;\n' +
                '}\n' +
                '</style>\n' +
                '# Hello!',

                '<!-- <style>\n' +
                '--&gt;\n' +
                '<style>\n' +
                'h1 {\n' +
                '  color: blue;\n' +
                '}\n' +
                '</style> -->' +
                '<h1 id="hello" style="color:blue;">Hello!</h1>'
            ],
            [
                '<style>\n\n</style>',
                '<!-- <style>\n\n</style> -->'
            ],
            [
                '[A][1]\n\n.\n\n[1]: example.com',
                this._divWrap(`${this._href('https://example.com', 'A', true)}`) +
                this._divWrap('.') +
                this._divWrap('<!-- [1]: example.com -->')
            ],
            [
                '# <span class="header">Test</span>',
                '<h1 id="test"><span>Test</span></h1>'
            ],
            [
                '<style>\n.errorHeader {\n  color: #D15141;\n}\n</style>\n<span class="errorHeader">Test</span>',
                '<!-- <style>\n.errorHeader {\n  color: #D15141;\n}\n</style> -->' +
                this._divWrap('<span style="color:#D15141;">Test</span>')
            ]
        );

        return this._runSingleSuite(tests, 'Fixed Bugs');
    }

    /// <summary>
    /// Manually test a single string to see its markdown output
    /// </summary>
    testString(testStr)
    {
        Log.info(`Testing : ${testStr}`);
        return new Markdown().parse(testStr);
    }

    /// <summary>
    /// Runs a single test suite denoted by the given testName
    /// </summary>
    _runSingleSuite(tests, testName)
    {
        Log.info(`Running suite: ${testName}`);
        return this._runCore(tests);
    }

    /// <summary>
    /// Core routine that actually runs the tests
    /// </summary>
    _runCore(tests)
    {
        let stats = { passed : 0, failed : 0 };
        let logSav = Log.getLevel();
        Log.setLevel(Log.Level.Info);
        let colors = this._consoleColors(Log.getDarkConsole());

        tests.forEach(function(test)
        {
            if (this.testCache)
            {
                this._testCache(test, colors, stats);
            }
            else
            {
                let result;
                try
                {
                    result = new Markdown().parse(test.input);
                }
                catch (e)
                {
                    result = e;
                }
                this._validateTest(test, result, colors, stats);
            }
        }, this);

        Log.setLevel(logSav);
        Log.info(`Ran ${stats.passed + stats.failed} Tests: Passed: ${stats.passed}  -  Failed: ${stats.failed}`);
        return stats;
    }

    /// <summary>
    /// Tests the Markdown caching mechanism by consecutively parsing each test
    /// character by character until finally parsing the entire input, then
    /// comparing it against the expected output
    /// </summary>
    _testCache(test, colors, stats)
    {
        let cacheSav = localStorage.getItem('mdCache');
        localStorage.setItem('mdCache', 1);
        let md = new Markdown();

        // Enter each character one by one, parsing after every step
        let result;
        try
        {
            let run = '';
            for (let i = 0; i < test.input.length - 1; ++i)
            {
                run += test.input[i];
                md.parse(run);
            }

            result = md.parse(test.input);
        }
        catch (e)
        {
            result = e;
        }

        this._validateTest(test, result, colors, stats);
        localStorage.setItem('mdCache', cacheSav);
    }

    /// <summary>
    /// Compares the given test result with the expected result, printing
    /// out a message indicating whether the test passed or failed
    /// </summary>
    _validateTest(test, result, colors, stats)
    {
        let displayInput = this._escapeTestString(test.input);
        let displayExpected = this._escapeTestString(test.expected);
        if (result == test.expected)
        {
            let logString = `    %cPassed!%c [%c${displayInput}%c]%c => %c[%c${displayExpected}%c]`;
            Log.formattedText(Log.Level.Info, logString, ...colors.success);
            ++stats.passed;
        }
        else
        {
            let displayResult = result;
            let diffIndex = 0;
            if (typeof(result) == 'string')
            {
                displayResult = this._escapeTestString(result);
                for (let i = 0; i < displayResult.length; ++i)
                {
                    if (displayResult[i] != displayExpected[i])
                    {
                        diffIndex = i;
                        break;
                    }
                }
            }

            let fixedIndent = ' '.repeat(36); // Indent from the consolelog header
            let logString = `   %cFAIL!\n` +
                `${fixedIndent}%cInput:    %c[%c${displayInput}%c]%c\n` +
                `${fixedIndent}Expected: %c[%c${this._errorString(displayExpected, diffIndex)}%c]%c\n` +
                `${fixedIndent}Actual:   %c[%c${this._errorString(displayResult, diffIndex)}%c]`;
            Log.formattedText(Log.Level.Warn, logString, ...colors.failure);
            ++stats.failed;
        }
    }

    /// <summary>
    /// Returns the message and callstack for the given exception, with the message
    /// highlighted for printing to the console.
    /// </summary>
    _exceptionText(ex)
    {
        return `\n%c${ex.message}%c\n${ex.stack.substring(ex.stack.indexOf('\n') + 1)}`;
    }

    /// <summary>
    /// Creates an array of { input, expected } pairs from the
    /// given array of [input, expected] arrays
    /// </summary>
    _buildTests(...tests)
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
    _escapeTestString(str)
    {
        return str.replace(/\n/g, '\\n');
    }

    _errorString(result, diffIndex)
    {
        if (typeof(result) != 'string')
        {
            return this._exceptionText(result);
        }

        let left = result.substring(0, diffIndex);
        let right = result.substring(diffIndex + 1);
        let middle = `%c${result[diffIndex]}%c`;
        return (left + middle + right).replace(/\n/g, '\\n');

    }

    /// <summary>
    /// Returns the ordered array of color formatting for successful and failed tests
    /// </summary>
    _consoleColors(dark)
    {
        let bracketClr = 'color: inherit';
        let textClr = `color: ${dark ? '#D1977F' : '#9E3379'}`;
        let arrowClr = `color: ${dark ? 'orange' : 'orangered'}`;
        let passClr = `color: ${dark ? '#00C000' : '#006000'}`;
        let failClr = `color: ${dark ? 'tomato' : 'red'}`;
        let diffClr = `color: ${dark ? 'black' : 'white'}; background-color: ${dark ? 'white' : 'black'}`;
        let successColors = [passClr, bracketClr, textClr, bracketClr, arrowClr, bracketClr, textClr, bracketClr];
        let failureColors =
        [
            failClr, // Fail!
            arrowClr, // Input label
            bracketClr,
            textClr, // Input
            bracketClr,
            arrowClr, // Expected label
            bracketClr,
            textClr, // Expected start
            diffClr, // Expected diff
            textClr, // Expected end
            bracketClr,
            arrowClr, // Actual label
            bracketClr,
            textClr, // Actual start
            diffClr, // Actual diff
            textClr, // Actual end
            bracketClr
        ];

        return { success : successColors, failure : failureColors };
    }

    /// <summary>
    /// Helper to add the containing mdDiv div that `parse` returns
    /// </summary>
    _divWrap(str)
    {
        return `<div class="mdDiv">${str}</div>`;
    }

    /// <summary>
    /// Helper to add the line number span to code block tests
    /// </summary>
    _preWrap(...lines)
    {
        let result = '';
        lines.forEach(function(line, lineNumber)
        {
            result += `<span class="codeLineNumber">${lineNumber + 1}</span>${line}\n`;
        });

        return result;
    }

    _href(href, text, external=false)
    {
        external = external || this.alwaysExternal;
        return `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
    }
}
