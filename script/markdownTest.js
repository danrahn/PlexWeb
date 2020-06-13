/* exported testMarkdown, testSuite */

// Markdown files are the only ones that prefer single-quotes over double.
/* eslint quotes: ["error", "single", { "avoidEscape" : true, "allowTemplateLiterals" : true }] */

const testMarkdown = function(testStr='')
{
    if (testStr.length == 0)
    {
        testStr = 'Hello, __There, how__ __are_ you_?';
    }

    logInfo(`testing: '${testStr}'`);
    return new Markdown().parse(testStr);
};

/// <summary>
/// Main test entrypoint, running all available tests
/// </summary>
const testSuite = function()
{
    // Simple tests for non-nested scenarios
    testHeaders();
    testUrl();
    testInline();
    testBold();
    testItalic();
    testStrikethrough();
    testUnderline();
    testHr();
    testBr();

    testMixed();
};

/// <summary>
/// Creates an array of { input, expected } pairs from the
/// given array of [input, expected] arrays
/// </summary>
const buildTests = function(...tests)
{
    let testStrings = [];
    for (let i = 0; i < tests.length; ++i)
    {
        testStrings.push({ input : tests[i][0], expected : tests[i][1] });
    }

    return testStrings;
};

/// <summary>
/// Helper to add the containing mdDiv div that `parse` returns
/// </summary>
const divWrap = function(str)
{
    return `<div class="mdDiv">${str}</div>`;
};

const testHeaders = function()
{
    logInfo('Testing Basic Header Functionality');
    let testStrings = buildTests(
        ['# Header 1', '<h1>Header 1</h1>'],
        ['## Header 2', '<h2>Header 2</h2>'],
        ['### Header 3', '<h3>Header 3</h3>'],
        ['#### Header 4', '<h4>Header 4</h4>'],
        ['##### Header 5', '<h5>Header 5</h5>'],
        ['###### Header 6', '<h6>Header 6</h6>'],
        ['####### Header 7', '<div class="mdDiv">####### Header 7</div>'],
        ['##Header 2', '<div class="mdDiv">##Header 2</div>'],
        ['  ## Header 2', '<h2>Header 2</h2>'],
        ['##   Header 2', '<h2>Header 2</h2>'],
        ['  ##   Header 2', '<h2>Header 2</h2>'],
        [' ## Header 2 ###  ', '<h2>Header 2</h2>']
    );

    testCore(testStrings);
};

const testUrl = function()
{
    logInfo('Testing Basic Url Functionality');
    let testStrings = buildTests(
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

    testCore(testStrings);
};

const testInline = function()
{
    logInfo('Testing Basic Inline Functionality');
    let testStrings = buildTests(
        ['`Inline Code`', divWrap('<code>Inline Code</code>')],
        ['\\`Inline Code`', divWrap('`Inline Code`')],
        ['``Inline ` Code``', divWrap('<code>Inline ` Code</code>')],
        ['`This isn\'t closed', divWrap('`This isn&#39;t closed')],
        ['`Hello _**++~~There~~++**_`', divWrap('<code>Hello _**++~~There~~++**_</code>')],
        ['`[Link](index.php)`', divWrap('<code>[Link](index.php)</code>')]
    );

    testCore(testStrings);
};

const testBold = function()
{
    logInfo('Testing Basic Bold Functionality');
    let testStrings = buildTests(
        ['**This is bold text**', divWrap('<strong>This is bold text</strong>')],
        ['** This is not bold text**', divWrap('** This is not bold text**')],
        ['Mismatched **Bold **Tags**', divWrap('Mismatched **Bold <strong>Tags</strong>')],
        ['****Nested Bold****', divWrap('<strong><strong>Nested Bold</strong></strong>')],
        [
            '****Different** **Nest** Patterns**',
            divWrap('<strong><strong>Different</strong> <strong>Nest</strong> Patterns</strong>')
        ],
        ['__This is bold text__', divWrap('<strong>This is bold text</strong>')],
        ['__ This is not bold text__', divWrap('__ This is not bold text__')],
        ['Mismatched __Bold __Tags__', divWrap('Mismatched __Bold <strong>Tags</strong>')],
        ['____Nested Bold____', divWrap('<strong><strong>Nested Bold</strong></strong>')],
        [
            '____Different__ __Nest__ Patterns__',
            divWrap('<strong><strong>Different</strong> <strong>Nest</strong> Patterns</strong>')
        ],
        ['__**Bold^2**__', divWrap('<strong><strong>Bold^2</strong></strong>')],
        ['__**Bold?__**', divWrap('<strong>**Bold?</strong>**')],
        ['**Multiline\nSupport**', divWrap('<strong>Multiline<br>Support</strong>')],
        ['**More\nThan\nTwo**', divWrap('<strong>More<br>Than<br>Two</strong>')],
        ['**Double\n\nNewline**', divWrap('**Double') + divWrap('Newline**')]
    );

    testCore(testStrings);
};

const testItalic = function()
{
    logInfo('Testing Basic Italic Functionality');
    let testStrings = buildTests(
        ['*This is italic text*', divWrap('<em>This is italic text</em>')],
        ['* This is not italic text*', '<ul><li>This is not italic text*</li></ul>'],
        ['Mismatched *italic *Tags*', divWrap('Mismatched *italic <em>Tags</em>')],
        [
            '**Different* *Nest* Patterns*',
            divWrap('<em><em>Different</em> <em>Nest</em> Patterns</em>')
        ],
        ['_This is italic text_', divWrap('<em>This is italic text</em>')],
        ['_ This is not italic text_', divWrap('_ This is not italic text_')],
        ['Mismatched _italic _Tags_', divWrap('Mismatched _italic <em>Tags</em>')],
        [
            '__Different_ _Nest_ Patterns_',
            divWrap('<em><em>Different</em> <em>Nest</em> Patterns</em>')
        ],
        ['_*italic^2*_', divWrap('<em><em>italic^2</em></em>')],
        ['_*italic?_*', divWrap('<em>*italic?</em>*')],
        ['_Multiline\nSupport_', divWrap('<em>Multiline<br>Support</em>')],
        ['_More\nThan\nTwo_', divWrap('<em>More<br>Than<br>Two</em>')],
        ['_Double\n\nNewline_', divWrap('_Double') + divWrap('Newline_')]
    );

    testCore(testStrings);
};

const testStrikethrough = function()
{
    logInfo('Testing Basic Strikethrough Functionality');
    let testStrings = buildTests(
        ['~~This text has a line going through it~~', divWrap('<s>This text has a line going through it</s>')],
        ['~~ This is not strikethrough~~', divWrap('~~ This is not strikethrough~~')],
        ['Mismatched ~~Strikethrough ~~Tags~~', divWrap('Mismatched ~~Strikethrough <s>Tags</s>')],
        ['~~~~Nested Strikethrough~~~~', divWrap('<s><s>Nested Strikethrough</s></s>')],
        [
            '~~~~Different~~ ~~Nest~~ Patterns~~',
            divWrap('<s><s>Different</s> <s>Nest</s> Patterns</s>')
        ],
        ['~~Multiline\nSupport~~', divWrap('<s>Multiline<br>Support</s>')],
        ['~~More\nThan\nTwo~~', divWrap('<s>More<br>Than<br>Two</s>')],
        ['~~Double\n\nNewline~~', divWrap('~~Double') + divWrap('Newline~~')]
    );

    testCore(testStrings);
};


const testUnderline = function()
{
    logInfo('Testing Basic Strikethrough Functionality');
    let testStrings = buildTests(
        ['++This text is underlined++', divWrap('<ins>This text is underlined</ins>')],
        ['++ This is not underlined++', divWrap('++ This is not underlined++')],
        ['Mismatched ++Underline ++Tags++', divWrap('Mismatched ++Underline <ins>Tags</ins>')],
        ['++++Nested Underline++++', divWrap('<ins><ins>Nested Underline</ins></ins>')],
        [
            '++++Different++ ++Nest++ Patterns++',
            divWrap('<ins><ins>Different</ins> <ins>Nest</ins> Patterns</ins>')
        ],
        ['++Multiline\nSupport++', divWrap('<ins>Multiline<br>Support</ins>')],
        ['++More\nThan\nTwo++', divWrap('<ins>More<br>Than<br>Two</ins>')],
        ['++Double\n\nNewline++', divWrap('++Double') + divWrap('Newline++')]
    );

    testCore(testStrings);
};

const testHr = function()
{
    logInfo('Testing Horizontal Rules');
    let testStrings = buildTests(
        ['---', '<hr />'],
        ['***', '<hr />'],
        ['___', '<hr />'],
        ['----------', '<hr />'],
        ['* * *', '<hr />'],
        ['  _    _    _    _', '<hr />']
    );

    testCore(testStrings);
};

const testBr = function()
{
    logInfo('Testing Line Breaks');
    let testStrings = buildTests(
        ['A\nB', divWrap('A<br />B')],
        ['A\n\nB', divWrap('A') + divWrap('B')],
        ['A\nB\nC', divWrap('A<br />B<br />C')]
    );

    testCore(testStrings);
};

const testMixed = function()
{
    logInfo('Testing Mixed Functionality');
    let testStrings = buildTests(
        [
            '# ___Header_ [`1`](link)__',
            '<h1><strong><em>Header</em> <a href="link"><code>1</code></a></strong></h1>'
        ],
        [
            '# ___Header__ [`1`](link)_',
            '<h1><em><strong>Header</strong> <a href="link"><code>1</code></a></em></h1>'
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

    testCore(testStrings);
};

/// <summary>
/// Core test routine. Passes each string through the markdown parser and
/// compares the result against our expected output.
/// </summary>
/// <param name="testStrings">Array of { input, expected } pairs</param>
const testCore = function(testStrings)
{
    let logSav = g_logLevel;
    g_logLevel = LOG.Info;
    testStrings.forEach(function(str)
    {
        let result = new Markdown().parse(str.input);
        if (result == str.expected)
        {
            logInfo(`    Passed! [${str.input}] => [${str.expected}]`);
        }
        else
        {
            logWarn(`    FAIL! Input: [${str.input}]\n\tExpected: [${str.expected}]\n\tActual:   [${result}]`);
        }
    });
    g_logLevel = logSav;
};
