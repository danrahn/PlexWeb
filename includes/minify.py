'''
This script goes through all the php files in the plex directory looking for
build_js statements. When it find one, it creates a temporary js file that combines
all the necessary includes, then runs terser on it.

This allows for maximally minized javascript that's contained to a single file per page
'''

import glob
import hashlib
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys

def process():
    '''Main entrypoint into the program'''

    clean_tmp()

    args_lower = [arg.lower() for arg in sys.argv]
    force = "-force" in args_lower or '-f' in args_lower
    babel = '-babel' in args_lower or '-b' in args_lower
    ultra = '-ultra' in args_lower or '-u' in args_lower
    quiet = '-quiet' in args_lower or '-q' in args_lower
    noicon = '-noicon' in args_lower
    onlyicon = '-icononly' in args_lower
    compare = '-cmp' in args_lower
    rem_log = 1 if '-notmi' in args_lower else 0
    if '-nolog' in args_lower:
        rem_log |= 2
    if '-nomdtmi' in args_lower:
        rem_log |= 4

    if '-s' in args_lower:
        files = [args_lower[args_lower.index('-s') + 1]]
    else:
        files = glob.glob("*.php")

    # First, check for changes to svg icons
    if not noicon:
        process_svg_icons(force, quiet)
    if onlyicon:
        return

    modified_dates = script_modified_dates()

    comparisons = {}
    if ultra and compare:
        for file in files:
            process_file(file, modified_dates, force, 0, False)

        print('Generating non-ultra for comparison')
        minify(babel, True)
        noultra = glob.glob('min/*.min.js')
        for file in noultra:
            cleanFile = file[file.rfind('/') + 1:]
            cleanFile = cleanFile[:file.find('.')]
            comparisons[cleanFile] = { 'noultra' : Path(file).stat().st_size, 'ultra' : 0 }
        clean_tmp()
        print()
        print('Generating ultra minified files')

    for file in files:
        process_file(file, modified_dates, force, rem_log, ultra)

    minify(babel, quiet)
    if ultra and compare:
        ultra_minified = glob.glob('min/*.min.js')
        for file in ultra_minified:
            cleanFile = file[file.rfind('/') + 1:]
            cleanFile = cleanFile[:file.find('.')]
            comparisons[cleanFile]['ultra'] = Path(file).stat().st_size


    if '-checklong' in args_lower:
        check_long_words(args_lower[args_lower.index('-checklong') + 1])

    if ultra and compare:
        cmp_sizes(comparisons)

    clean_tmp()


def process_svg_icons(force, quiet):
    print('Looking for updated icons...')
    old_icons = glob.glob('icon/*.svg')
    new_icons = []
    icons = glob.glob('icon/base/*.svg')
    js_icon_map = '/* exported icons */\nconst icons =\n{'
    changed = 0
    for icon in icons:
        with open(icon, 'rb') as filebytes:
            core = icon[icon.rfind(os.sep) + 1:]
            core = core[:core.find('.')]
            hashed = hashlib.md5(filebytes.read()).hexdigest()[:10]
            newpath = 'icon' + os.sep + core + '.' + hashed + '.svg'
            if force or not os.path.exists(newpath):
                print('  Copying', "'" + icon + "' to", "'" + newpath + "'")
                shutil.copyfile(icon, newpath)
                changed += 1
            elif not quiet:
                print(' ', icon, 'up to date')
            new_icons.append(newpath)
            js_icon_map += '\n' + '    ' + core.upper() + ' : "' + newpath + '",'

    for icon in old_icons:
        if not icon in new_icons:
            os.remove(icon)
            changed = -1

    if changed == 0:
        print('Icons up to date!\n')
    else:
        if changed != -1:
            print('  Modified', changed, 'icon' + ('' if changed == 1 else 's'))

        print('  Writing icon map...')
        js_icon_map += '\n};\n'
        js_icon_map = js_icon_map.replace('\\', '/')
        with open('script/iconMap.js', 'w+') as js_icon_file:
            js_icon_file.write(js_icon_map)
        print('Done processing icons\n')

def cmp_sizes(comp):
    for file in comp:
        noultra = comp[file]['noultra']
        ultra = comp[file]['ultra']
        print(file + ':', noultra, 'to', ultra, ':', str(round((1 - (ultra / noultra)) * 100, 2)) + '%')
    # cur = glob.glob('min/*.min.js')
    # old = glob.glob('min_preultra/*.min.js')
    # for i in range(len(cur)):
    #     curSize = Path(cur[i]).stat().st_size
    #     oldSize = Path(old[i]).stat().st_size
    #     print(cur[i][:cur[i].find('.')] + ':', oldSize, 'to', str(curSize) + ':', str(round((1 - (curSize / oldSize)) * 100, 2)) + '%')


def check_long_words(min_letters):
    files = glob.glob("min/*.min.js")
    words = {}
    for file in files:
        lines = get_lines(file)
        for match in re.findall(r'\b[$_a-zA-Z][\w]{' + str(int(min_letters) - 1) + r',}\b', lines):
            if not match in words:
                words[match] = 0
            words[match] += len(match)

    sorted_words = sorted(words.items(), reverse=True, key=lambda x: x[1])
    i = 0
    for e in sorted_words:
        print(e[0],'-',e[1],'bytes')
        i += 1
        if i == 20:
            break


def process_file(file, modified_dates, force, rem_log, ultra):
    '''Process a single file (if needed)'''

    lines = get_lines(file)
    if len(lines) == 0:
        return

    includes = get_includes(lines)
    if len(includes) == 0:
        return # File has no build_js, so don't build anything

    if not force and not needs_parse(file, includes, modified_dates):
        print(file, "up to date")
        return

    combined = create_temp(includes, rem_log, ultra)
    write_temp(file, combined)


def get_lines(file):
    with open(file) as content:
        try:
            return ''.join(content.readlines())
        except:
            print("Error processing", file)
            return ''


def get_includes(lines):
    ''' Get the list of includes for the file

    Example:
        If our php file contains the following:
            <?php build_js("index", "consolelog", "animate") ?>
        We will return
            ["consolelog", "animate", "index"]
    '''

    start = lines.find('build_js')
    if start == -1:
        return [] # no build_js, nothing to do

    includes = lines[start + 9:lines.find(')', start)].split(', ')
    includes = [include.replace('"', '') for include in includes]

    # The main script is first, but we want to include it last
    tmp = includes[0]
    includes.pop(0)
    includes.append(tmp)
    return includes


def needs_parse(file, includes, modified_dates):
    ''' Determine if we should re-minify the file given it's desired includes

    We only need to parse if last modified date of the minified file is older
    than the PHP file or any of the scripts it includes
    '''
    min_file = 'min/' + file[:file.rfind('.')] + '.*.min.js'
    fileglob = glob.glob(min_file)
    min_mod = 0 if len(fileglob) == 0 else os.stat(fileglob[0]).st_mtime
    # min_mod = 0 if not os.path.exists(min_file) else os.stat(min_file).st_mtime
    php_mod = os.stat(file).st_mtime

    if php_mod > min_mod:
        return True

    needs_parse = False
    for include in includes:
        if not include in modified_dates or modified_dates[include] > min_mod:
            needs_parse = True
            break
    return needs_parse


def create_temp(includes, rem_log, ultra):
    combined = '(function(){'
    consolelog = ''
    for include in includes:
        include_file = 'script/' + include + '.js'
        if include == "consolelog":
            # consolelog has functions that we want users to have access to, so it can't go in the inner scope
            consolelog = get_lines(include_file)
            continue
        lines = get_lines(include_file)

        # Experimental. Attempts to remove all logTmi entries from the source file.
        # The regex is simple, so things could go wrong if funky comments/log statements are used.
        if rem_log & 3 != 0:
            reg = r'(\/\*@__PURE__\*\/)?\blogTmi\(.*\); *\n'
            if rem_log & 2 == 2:
                # More for testing than anything else. Completely re move _all_ logs, even info/warn/error
                reg = r'(\/\*@__PURE__\*\/)?\blog(Tmi|Verbose|Info|Warn|Error)\(.*\); *\n'
            lines = re.sub(reg, '', lines)

        if include == "markdown" and ultra:
            # Very hacky,  but minifiers aren't great at minifying classes/enums, but in
            # this specific case we know it's okay to do so do some pre-minification
            lines = preminify_markdown(lines, rem_log == 4)
        combined += '/* ' + include + '*/\n' + lines + '\n\n'

    combined += '})();'
    if ultra:
        combined = '(function(){ Element.prototype.a = Element.prototype.appendChild; ' +\
            'Element.prototype.l = Element.prototype.addEventListener;\n' +\
            'window.l = window.addEventListener;\n' +\
            'document.l = document.addEventListener;\n' +\
            'let p_ = parseInt;\n' +\
            combined[12:]
        combined = re.sub(r'\.appendChild\(', '.a(', combined)
        combined = re.sub(r'\.addEventListener\(', '.l(', combined)
        combined = re.sub(r'\bparseInt\(', 'p_(', combined)
        combined = minify_process_request(combined)
        combined = minify_keycodes(combined)
    if len(consolelog) > 0:
        # prepend this outside of our scope
        if ultra:
            test_all = consolelog.find('function testAll()')
            consolelog = consolelog.replace(consolelog[test_all:consolelog.find('}', test_all) + 1], '')
            consolelog = consolelog.replace('g_levelColors', 'g_c')
            consolelog = consolelog.replace('g_traceColors', 'g_t')
            consolelog = consolelog.replace('g_traceLogging', 'g_tl')
            consolelog = consolelog.replace('g_darkConsole', 'g_dc')
            consolelog = consolelog.replace('_inherit', '_i')
            consolelog = 'let l_ = localStorage; ' + consolelog.replace('localStorage', 'l_')
        combined = consolelog + combined

    return combined

# Minify the ProcessRequest enum via direct substitution
def minify_process_request(combined):
    start = combined.find('\nconst ProcessRequest =')
    if start == -1:
        return combined

    end = combined.find('}', start)
    definition = combined[start:end]
    combined = combined[:start] + combined[end + 2:]
    results = re.findall(r'(\w+) : (\d+)', definition)
    for result in results:
        combined = combined.replace('ProcessRequest.' + result[0], str(result[1]))
    return combined

# Minify the KEY enum via direct substitution
def minify_keycodes(combined):
    start = combined.find('\nconst KEY =')
    if start == -1:
        return

    end = combined.find('}', start)
    definition = combined[start:end]
    combined = combined[:start] + combined[end + 2:]
    results = re.findall(r'([A-Z_]+) +: (\d+)', definition)
    for result in results:
        combined = combined.replace('KEY.' + result[0], str(result[1]))
    return combined


def write_temp(file, combined):
    if not os.path.exists('tmp'):
        os.makedirs('tmp')
    with open('tmp/' + file[:file.rfind('.')] + '.tmp.js', 'w+') as temp_file:
        temp_file.write(combined)


def script_modified_dates():
    '''return a dictionary of the last modified time for all files in script/'''
    last_modified = {}
    files = glob.glob('script/*.js')
    for file in files:
        last_modified[file[file.find(os.sep) + 1:file.rfind('.')]] = os.stat(file).st_mtime
    return last_modified


def preminify_markdown(lines, rem_tmi):
    '''
    We can save a few extra KBs by doing some targeted minification on
    markdown.js that our minification tools would otherwise overlook
    '''

    # start with states. This is copied from markdown.js
    define = '''const State =
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
}'''
    newStates = '''
const State =
{
    N : 0,
    D : 1,
    L : 2,
    H : 3,
    O : 4,
    U : 5,
    I : 6,
    R : 7,
    C : 8,
    B : 9,
    T : 10,
    Y : 11,
    M : 12,
    K : 13,
    X : 14,
    E : 15,
    A : 16,
    S : 17,
    Z : 18
}
    '''
    rep = {
        'None' : 'N',
        'Div' : 'D',
        'LineBreak' : 'L',
        'Hr' : 'H',
        'OrderedList' : 'O',
        'UnorderedList' : 'U',
        'ListItem' : 'I',
        'Header' : 'R',
        'CodeBlock' : 'C',
        'BlockQuote' : 'B',
        'Table' : 'T',
        'Url' : 'Y',
        'Image' : 'M',
        'InlineCode' : 'K',
        'Bold' : 'X',
        'Underline' : 'E',
        'Italic' : 'A',
        'Strikethrough' : 'S',
        'HtmlComment' : 'Z'
    }

    idx = lines.find(define)
    if idx == -1:
        print('Error pre-minifying markdown. Couldn\'t find State definition, did it change?')
        return lines
    lines = lines.replace(define, newStates)
    for key in rep:
        lines = lines.replace('State.' + key, 'State.' + rep[key])

    # stateToStr takes up a lot of space when it probably doesn't have to for the minified version
    # Save several hundred bytes by removing it
    start = lines.find('const stateToStr')
    if start != -1:
        end = lines.find('}', lines.find('}', start) + 1) + 1
        if end != -1:
            lines = lines.replace(lines[start:end], 'let stateToStr = (state) => state;')

    # Check whether we should remove TMI logging. There is a
    # separate flag for markdown-specific removal, since it's especially noisy
    if rem_tmi:
        lines = re.sub(r'(\/\*@__PURE__\*\/)?\blogTmi\(.*\); *\n', '', lines)

    # Now look for things that are very method-like.
    curVar = 'a'

    v = 0
    for match in re.finditer(r'\n    (_\w+)\(', lines):
        v += 1
        lines = re.sub(r'\b' + match.group(1) + r'\b', curVar, lines)

        # skip over i/j/k. Hopefully I remember not to have
        # other single-letter variable names
        if curVar == 'h':
            curVar = 'l'
        elif curVar == 'z':
            curVar = 'A'
        else:
            curVar = chr(ord(curVar) + 1)

        if curVar == 'Z':
            print('Ran out of method variable names! Consider rewriting this mess')
            break

    # currentRun is used quite a bit
    lines = re.sub(r'\bthis\.currentRun\b', 'this.X', lines)

    # State of a run
    lines = re.sub(r'\.state\b', '.s', lines)

    # Inner runs
    lines = re.sub(r'\binnerRuns\b', '_i', lines)

    # Run methods
    lines = re.sub(r'\bstartContextLength\b', '_S', lines)
    lines = re.sub(r'\bendContextLength\b', '_E', lines)
    lines = re.sub(r'\btransform\b', '_T', lines)

    # TODO: this.text is _very_ heavily used, but multiple classes
    # use this, so it breaks things.

    # Now getting real hacky. Modify String's prototype to save a hundred bytes or so
    # Some should already be done if 'ultra' is set, so don't do anything in that case
    lines = re.sub(r'\.indexOf\(', '.i(', lines)
    lines = 'String.prototype.i = String.prototype.indexOf;\n' + lines
    lines = 'Array.prototype.i = Array.prototype.indexOf;\n' + lines

    lines = re.sub(r'\.substring\(', '.s(', lines)
    lines = 'String.prototype.s = String.prototype.substring;\n' + lines

    return lines


def minify(babel, quiet):
    '''Invoke terser to minify our build js files'''
    if not os.path.exists('tmp'):
        print("Nothing changed!")
        return

    options = [
        'booleans_as_integers',
        'ecma=8',
        'keep_fargs=false',
        'passes=3',
        'unsafe',
        'unsafe_math',
        'warnings',
        'arguments',
        'hoist_funs'
    ]

    options_babel = [
        'mangle',
        'simplify',
        'booleans',
        'builtIns',
        'consecutiveAdds',
        'deadcode',
        'evaluate',
        'flipComparisons',
        'memberExpressions',
        'mergeVars',
        'numericLiterals',
        'propertyLiterals',
        'regexpConstructors',
        'removeUndefined',
        'simplifyComparisons',
        'undefinedToVoid'
    ]

    files = glob.glob("tmp/*.js")
    for file in files:
        run_cmd(file, options_babel if babel else options, babel, quiet)


def run_cmd(file, options, babel, quiet):
    base_file = file[file.find(os.sep) + 1:file.find('.')]
    remove_existing(base_file)
    file_hash = get_hash(file)
    clean_file = base_file + '.' + file_hash + '.min.js'
    print('Minifying', clean_file)
    system = platform.system()
    if system == 'Windows':
        if babel:
            cmd_params = ' --' + ' --'.join(options)
            cmd = 'node.exe ' + os.environ['APPDATA'] + r'\npm\node_modules\babel-minify\bin\minify.js '
            cmd += file + cmd_params + ' --o min\\' + clean_file
        else:
            cmd_params = ' -c ' + ','.join(options) + ' -m'
            cmd = 'node.exe ' + os.environ['APPDATA'] + r'\npm\node_modules\terser\bin\terser '
            cmd += file + ' -o min\\' + clean_file + cmd_params
    elif system == 'Linux':
        cmd = ['terser', file, '-o', 'min/' + clean_file, '-c', ','.join(options), '-m']
    else:
        print('Unsupported OS:', os)
    output = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8')
    if not quiet:
        process_output(output)
        print()


def remove_existing(base):
    for file in glob.glob('min' + os.sep + base + '.*.min.js'):
        os.remove(file)


def get_hash(file):
    with open(file, 'rb') as filebytes:
        # Just return the last 10 digits. Likelihood of overlap is still miniscule
        return hashlib.md5(filebytes.read()).hexdigest()[:10]


def process_output(output):
    lines = output.split('\n')
    pure = 0
    for line in lines:
        if (len(line) == 0):
            continue

        # __PURE__ warnings are usually just noise. Collapse them into a single statement
        if line.lower().startswith('warn: dropping __pure__'):
            pure += 1
            continue

        # Other errors might be more interesting. Since it's parsing temporary
        # files, print out the line in question so we can get more context
        file = line[line.rfind('[') + 1:line.rfind(':')]
        fileLine = int(line[line.rfind(':') + 1:line.rfind(',')])

        print(line)
        print('    >', get_lines(file).split('\n')[fileLine - 1].strip())



    if pure != 0:
        print('Dropped', pure, 'pure calls')


def clean_tmp():
    if os.path.exists('tmp'):
        shutil.rmtree('tmp')

process()