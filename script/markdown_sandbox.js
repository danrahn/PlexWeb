// Markdown files are the only ones that prefer single-quotes over double.
/* eslint quotes: ["error", "single", { "avoidEscape" : true, "allowTemplateLiterals" : true }] */
let md = new Markdown();

function forceParseMarkdown() { parseMarkdownCore(true); }
function parseMarkdown() { parseMarkdownCore(false); }
function parseMarkdownCore(force)
{
    if (!force && !document.querySelector('#liveupdate').checked)
    {
        return;
    }

    const text = $('#query').value;
    Log.tmi(`Parsing "${text}"`);
    let html;
    if (force)
    {
        html = new Markdown().parse(text);
    }
    else
    {
        html = md.parse(text);
    }

    if (!md.sameText)
    {
        $('.md')[0].innerHTML = html;
    }
}

function parseShortcuts(e)
{
    if (e.keyCode == KEY.ENTER && e.ctrlKey)
    {
        forceParseMarkdown();
    }
}

$('#markdownSubmit').addEventListener('click', forceParseMarkdown);
$('#query').addEventListener('change', parseMarkdown);
$('#query').addEventListener('keyup', parseMarkdown);

$('#query').addEventListener('keydown', parseShortcuts);
MarkdownEditor.addTabHandler($('#query'));
MarkdownEditor.addAutoCompleteHandler($('#query'));
MarkdownEditor.addFormatHandler($('#query'));
$('#query').parentNode.insertBefore(MarkdownEditor.getToolbar($('#query')), $('#query'));

$('#markdownTestSuite').addEventListener('click', function()
{
    let testCache = $('#testcache').checked;
    let testResults = new MarkdownTestSuite().runSuite(testCache);
    let totalTests = testResults.passed + testResults.failed;
    let passRate = ((testResults.passed / totalTests) * 100).toFixed(2);
    let auxText = (totalTests == testResults.passed ? '. Yay!' : '') + '\n\nSee the console (F12) for more details';
    alert(`Test Results${testCache ? ' (with cache)' : ''}: Passed ${testResults.passed} of ${totalTests} tests (${passRate}%)${auxText}`);
});

MarkdownHelp.getHelp(function(response)
{
    $('#query').value = response.data;
    parseMarkdown();
}, true /*raw*/);

window.addEventListener('resize', checkWindowSize);

function checkWindowSize()
{
    if (window.innerWidth < 1000)
    {
        let container = $('#container');
        if (container.classList.contains('sxs'))
        {
            container.classList.toggle('sxs');
            let query = $('#query');
            query.style.height = 'unset';
            query.setAttribute('rows', 20);
        }

        let sxs = $('#sideBySide');
        if (sxs)
        {
            sxs.parentNode.parentNode.removeChild(sxs.parentNode);
        }
    }
    else if (!$('#sideBySide'))
    {
        $('#options').appendChild(
            buildNode('label', { for : 'sideBySide' }, 'SxS: ').appendChildren(
                buildNode('input', { type : 'checkbox', id : 'sideBySide' }, 0, { change : sxsChanged })));

        if (parseInt(localStorage.getItem('mdSandbox_sxs')) == 1)
        {
            let sxs = $('#sideBySide');
            sxs.checked = true;
            sxs.dispatchEvent(new Event('change'));
        }
    }
}

function sxsChanged()
{
    $('#container').classList.toggle('sxs');
    if (this.checked)
    {
        $('#query').style.height = '80vh';
    }
    else
    {
        $('#query').style.height = 'unset';
        $('#query').setAttribute('rows', 20);
    }

    localStorage.setItem('mdSandbox_sxs', this.checked ? 1 : 0);
}

checkWindowSize();
