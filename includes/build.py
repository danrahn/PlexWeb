'''
Checks source files (js, css, svg) for changes and copies them to their respective
directories. Also bundles and minifies javascript files by going through all the php
files in the plex directory looking for build_js statements. When it find one, it
creates a temporary js file that combines all the necessary includes, then runs terser
on it. This allows for maximally minized javascript that's contained to a single file per page
'''

import glob
import hashlib
import json
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
    nocss = '-nocss' in args_lower
    onlycss = '-cssonly' in args_lower
    cleancss = '-cleancss' in args_lower
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
    if not noicon and not onlycss:
        process_svg_icons(force, quiet)
    if onlyicon:
        return
    
    deps = json.loads(get_lines('includes' + os.sep + 'deps.json'))

    if not nocss and not onlyicon:
        process_css(files, deps, force, quiet, not cleancss)
    if onlycss:
        return

    modified_dates = get_modified_dates('script/*.js')

    comparisons = {}
    if ultra and compare:
        for file in files:
            process_file(file, modified_dates, deps, force, 0, False, quiet)

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

    print('Looking for updated javascript...')
    any_modified_js = False
    for file in files:
        any_modified_js = process_file(file, modified_dates, deps, force, rem_log, ultra, quiet) or any_modified_js
    if not any_modified_js and quiet:
        print('Javascript up to date!')

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
    '''
    Looks for new/modified SVG icons and copies them to the root icon folder
    with a hash attached to the file name for cache efficiency
    '''

    print('Looking for updated icons...')
    old_icons = glob.glob('min/icon/*.svg')
    new_icons = []
    icons = glob.glob('icon/*.svg')
    js_icon_map = '/* exported icons */\nconst icons =\n{'
    changed = 0
    for icon in icons:
        with open(icon, 'rb') as filebytes:
            core = icon[icon.rfind(os.sep) + 1:]
            core = core[:core.find('.')]
            hashed = hashlib.md5(filebytes.read()).hexdigest()[:10]
            newpath = 'min/icon/' + core + '.' + hashed + '.svg'
            if force or not os.path.exists(newpath):
                print('  Copying', "'" + icon + "' to", "'" + newpath + "'")

                # Minify svg and place in new location
                minify_svg(icon, newpath, quiet)
                # shutil.copyfile(icon, newpath)
                changed += 1
            elif not quiet:
                print(' ', icon, 'up to date')
            new_icons.append(newpath)
            js_icon_map += '\n' + '    ' + core.upper() + ' : "' + newpath + '",'

    for icon in old_icons:
        if not icon.replace('\\', '/') in new_icons:
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

def minify_svg(icon, newpath, quiet):
    system = platform.system()
    if system == 'Windows':
        cmd = 'node.exe ' + os.environ['APPDATA'] + r'\npm\node_modules\svgo\bin\svgo ' + icon + ' -o ' + newpath
    elif system == 'Linux':
        cmd = ['svgo', icon, '-o', newpath]
    else:
        print('Unsupported OS:', os)
    output = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8')
    if not quiet and len(output) != 0:
        print(output)
        print()

def process_css(files, deps, force, quiet, csso):
    '''
    Processes css includes for each page, bundles them into a temp
    file, and runs clean-css-cli on it.
    '''
    print('Looking for updated CSS...')
    modified_dates = get_modified_dates('style/*.css')
    modified_any = False
    for file in files:
        includes = get_css_deps(file, deps)
        if len(includes) == 0:
            continue
        if not force and not needs_parse(file, includes, modified_dates, 'min/style/' + file[:file.rfind('.')] + '.*.min.css'):
            if not quiet:
                print(file, 'up to date')
            continue
        combined = ''
        for include in includes:
            include_file = 'style/' + include + '.css'
            combined += '/* ' + include + '.css */\n' + get_lines(include_file) + '\n\n'
        write_temp(file, combined, 'css')
        tmp_file = 'tmp' + os.sep + file[:file.rfind('.')] + '.tmp.css'
        base_file = file[file.find(os.sep) + 1:file.find('.')]
        for existing in glob.glob('min/style/' + base_file + '.*.min.css'):
            os.remove(existing)
        file_hash = get_hash(tmp_file)
        clean_file = base_file + '.' + file_hash + '.min.css'
        system = platform.system()
        modified_any = True
        if system == 'Windows':
            print('Minifying', clean_file)
            cmd_params = (' ' + tmp_file + ' -o min\\style\\' + clean_file) if csso else (' -O2 -o min\\style\\' + clean_file + ' ' + tmp_file)
            cmd = 'node.exe ' + os.environ['APPDATA'] + r'\npm\node_modules'
            cmd += r'\csso-cli\bin\csso ' if csso else r'\clean-css-cli\bin\cleancss '
            cmd += cmd_params
            output = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8')
            if len(output) != 0:
                print('   ', output)
        else:
            print('Copying', clean_file, 'to main directory')
            shutil.copyfile(tmp_file, 'min/style/' + clean_file)
    clean_tmp()
    if not modified_any and quiet:
        print('CSS up to date!')
    print()


def get_css_deps(file, deps):
    res = []
    raw = file[:file.rfind('.')]
    if not raw in deps:
        return res

    includes = deps[raw]['css']
    if "style" in includes:
        res.append("style")

    get_css_deps_from_js(raw, deps, res)

    for include in includes:
        if include != "style" and include != raw:
            res.append(include)

    if raw in includes:
        if raw in res:
            res.remove(raw)
        res.append(raw)
    
    return res


def get_css_deps_from_js(dep, deps, res):
    if not dep in deps:
        return

    for include in deps[dep]['js']:
        if include in deps:
            for css in deps[include]['css']:
                if not css in res:
                    res.append(css)
                    get_css_deps_from_js(css, deps, res)
            if not include in res:
                get_css_deps_from_js(include, deps, res)


def cmp_sizes(comp):
    for file in comp:
        noultra = comp[file]['noultra']
        ultra = comp[file]['ultra']
        print(file + ':', noultra, 'to', ultra, ':', str(round((1 - (ultra / noultra)) * 100, 2)) + '%')


def check_long_words(min_letters):
    '''
    Checks minified files for tokens that take up the most bytes, gated on the passed in minimum word length
    '''

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


def process_file(file, modified_dates, deps, force, rem_log, ultra, quiet):
    '''Process a single file (if needed)'''

    lines = get_lines(file)
    if len(lines) == 0:
        return False

    includes = get_deps(file, deps)
    if len(includes) == 0:
        return False # File has no build_js, so don't build anything

    if not force and not needs_parse(file, includes, modified_dates, 'min/' + file[:file.rfind('.')] + '.*.min.js'):
        if not quiet:
            print(file, "up to date")
        return False

    combined = create_temp(includes, rem_log, ultra)
    write_temp(file, combined, 'js')
    return True


def get_lines(file):
    '''Returns all lines of the given file as a single string'''
    with open(file) as content:
        try:
            return ''.join(content.readlines())
        except:
            print("Error processing", file)
            return ''


def get_deps(file, deps):
    ''' Gets the dependencies for the given php file'''
    res = []
    raw = file[:file.rfind('.')]
    if not raw in deps:
        return res
    get_deps_core(raw, deps, res)
    res.append(raw) # Always add the page's core js file last

    # Order doesn't matter too much, but consolelog and common
    # should be first
    has_consolelog = "consolelog" in res
    has_common = "common" in res
    if has_consolelog and res[0] != "consolelog":
        res.remove("consolelog")
        res.insert(0, "consolelog")

    if has_common and res[1 if has_consolelog else 0] != "common":
        res.remove("common")
        res.insert(1 if has_consolelog else 0, "common")
    return res

def get_deps_core(dep, deps, res):
    '''Recursively add dependencies if they're not already part of the result'''
    for include in deps[dep]['js']:
        if not include in res:
            res.append(include)
            get_deps_core(include, deps, res)



def needs_parse(file, includes, modified_dates, min_file):
    ''' Determine if we should re-minify the file given it's desired includes

    We only need to parse if last modified date of the minified file is older
    than the PHP file or any of the scripts it includes
    '''
    fileglob = glob.glob(min_file)
    min_mod = 0 if len(fileglob) == 0 else os.stat(fileglob[0]).st_mtime
    # min_mod = 0 if not os.path.exists(min_file) else os.stat(min_file).st_mtime
    php_mod = os.stat(file).st_mtime

    if php_mod > min_mod:
        return True

    should_parse = False
    for include in includes:
        if not include in modified_dates or modified_dates[include] > min_mod:
            should_parse = True
            break
    return should_parse


def create_temp(includes, rem_log, ultra):
    '''
    Creates a temporary javascript file that combines all the necessary includes for a web page.

    Arguments:
        rem_log: integer describing what (if any) logging statements should be removed to further reduce file size
        ultra: if True, does additional generally unsafe preprocessing to further reduce file size
    '''

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
        combined = minify_icons(combined)
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
    '''
    Removes the ProcessRequest enum from the given string using direct substitution
    '''
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
    '''
    Removes the KEY enum from the given string using direct substitution
    '''
    start = combined.find('\nconst KEY =')
    if start == -1:
        return combined

    end = combined.find('}', start)
    definition = combined[start:end]
    combined = combined[:start] + combined[end + 2:]
    results = re.findall(r'([A-Z_]+) +: (\d+)', definition)
    for result in results:
        combined = re.sub(f'\\bKEY\\.{result[0]}\\b', str(result[1]), combined)
    return combined


def minify_icons(combined):
    '''
    Remove the icon map via direct substitution.
    NOTE: Depending on how many icons are used, and how often, this could
          result in a larger file.
    '''
    start = combined.find('\nconst icons =\n')
    if start == -1:
        return combined
    end = combined.find('}', start)
    definition = combined[start:end]
    combined = combined[:start] + combined[end + 2:]
    results = re.findall(r'([A-Z_]+) +: ("[^"]+")', definition)
    for result in results:
        combined = re.sub(f'\\bicons\\.{result[0]}\\b', str(result[1]), combined)
    return combined


def write_temp(file, combined, ext):
    '''
    Writes the given combined contents to the given file name in a temporary directory
    '''
    if not os.path.exists('tmp'):
        os.makedirs('tmp')
    with open('tmp/' + file[:file.rfind('.')] + '.tmp.' + ext, 'w+') as temp_file:
        temp_file.write(combined)


def get_modified_dates(filter):
    '''return a dictionary of the last modified time for all files in script/'''
    last_modified = {}
    files = glob.glob(filter)
    for file in files:
        last_modified[file[file.find(os.sep) + 1:file.rfind('.')]] = os.stat(file).st_mtime
    return last_modified


def preminify_markdown(lines, rem_tmi):
    '''
    We can save a few extra KBs by doing some targeted minification on
    markdown.js that our minification tools would otherwise overlook
    '''

    # start with direct replacement for the State enum
    lines = minify_markdown_state_enum(lines)

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

    # currentRun is used quite a bit
    lines = re.sub(r'\bthis\.currentRun\b', 'this.' + next_var(), lines)

    # State of a run - Disabled because other classes use .state
    # lines = re.sub(r'\.state\b', '.' + next_var(), lines)

    # Inner runs
    lines = re.sub(r'\binnerRuns\b', next_var(), lines)

    # Run methods
    lines = re.sub(r'\bstartContextLength\b', next_var(), lines)
    lines = re.sub(r'\bendContextLength\b', next_var(), lines)
    lines = re.sub(r'\btransform\b', next_var(), lines)

    # Now look for things that are very method-like.
    v = 0
    for match in re.finditer(r'\n    (_\w+)\(', lines):
        v += 1
        cur_var = next_var()
        if cur_var == '':
            return lines
        lines = re.sub(r'\b' + match.group(1) + r'\b', cur_var, lines)

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


def minify_markdown_state_enum(lines):
    '''
    Uses direct substitution to remove the State enum from markdown.js
    '''

    start = lines.find('\nconst State =')
    if start == -1:
        print('Error pre-minifying markdown. Couldn\'t find State definition, did it change?')
        return lines

    end = lines.find('}', start)
    definition = lines[start:end]
    lines = lines[:start] + lines[end + 2:]
    results = re.findall(r'(\w+) : (\d+)', definition)
    for result in results:
        lines = lines.replace('State.' + result[0], str(result[1]))
    return lines


g_var_cur = 'a'
def next_var():
    '''
    Returns the next available minified variable, tracked globally
    '''

    global g_var_cur

    # skip over i/j/k. Hopefully I remember not to have
    # other single-letter variable name
    base = g_var_cur[:len(g_var_cur) - 1]
    cur = g_var_cur[len(g_var_cur) - 1]
    if cur == 'h' and base == '':
        cur = 'l'
    elif cur == 'z':
        cur = 'A'
    elif cur == 'Z':
        cur = 'a'
        if base == '':
            base = '_'
        elif base == '_':
            base = '_a'
        elif base == '_z':
            print('Why are there so many method names?! Things are broken, consider rewriting this mess')
            return ''
        else:
            base = base[0] + chr(ord(base[1]) + 1)
    else:
        cur = chr(ord(cur) + 1)
    g_var_cur = base + cur
    return g_var_cur


def minify(babel, quiet):
    '''Invoke terser to minify our build js files'''
    if not os.path.exists('tmp'):
        return

    options = [
        'booleans_as_integers',
        'ecma=8',
        'keep_fargs=false',
        'passes=3',
        'unsafe=true',
        'unsafe_math',
        'unsafe_methods=true',
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
    '''Finally invoke the node command to minify the given file'''
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
            cmd += file + cmd_params + ' --o min\\script\\' + clean_file
        else:
            cmd_params = ' -c ' + ','.join(options) + ' -m'
            cmd = 'node.exe ' + os.environ['APPDATA'] + r'\npm\node_modules\terser\bin\terser '
            cmd += file + ' -o min\\script\\' + clean_file + cmd_params
    elif system == 'Linux':
        cmd = ['terser', file, '-o', 'min/script/' + clean_file, '-c', ','.join(options), '-m']
    else:
        print('Unsupported OS:', os)
    output = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8')
    if not quiet:
        process_output(output)
        print()


def remove_existing(base):
    '''Remove all minified files from the min directory'''
    for file in glob.glob('min/script' + os.sep + base + '.*.min.js'):
        os.remove(file)


def get_hash(file):
    '''Returns the md5 hash of the given file, truncated to the last 10 digits'''
    with open(file, 'rb') as filebytes:
        # Just return the last 10 digits. Likelihood of overlap is still miniscule
        return hashlib.md5(filebytes.read()).hexdigest()[:10]


def process_output(output):
    '''
    Processes and filters minification output to reduce noise
    '''
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