'''
This script goes through all the php files in the plex directory looking for
build_js statements. When it find one, it creates a temporary js file that combines
all the necessary includes, then runs terser on it.

This allows for maximally minized javascript that's contained to a single file per page
'''

import glob
import os
import platform
import shutil
import subprocess
import sys

def process():
    '''Main entrypoint into the program'''

    clean_tmp()

    modified_dates = script_modified_dates()

    args_lower = [arg.lower() for arg in sys.argv]
    force = "-force" in args_lower or '-f' in args_lower

    files = glob.glob("*.php")
    for file in files:
        process_file(file, modified_dates, force)

    minify()

    clean_tmp()


def process_file(file, modified_dates, force):
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

    combined = create_temp(includes)
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
    min_file = 'min/' + file[:file.rfind('.')] + '.min.js'
    min_mod = 0 if not os.path.exists(min_file) else os.stat(min_file).st_mtime
    php_mod = os.stat(file).st_mtime

    if php_mod > min_mod:
        return True

    needs_parse = False
    for include in includes:
        if not include in modified_dates or modified_dates[include] > min_mod:
            needs_parse = True
            break
    return needs_parse


def create_temp(includes):
    combined = '(function(){'
    consolelog = ''
    for include in includes:
        include_file = 'script/' + include + '.js'
        if include == "consolelog":
            # consolelog has functions that we want users to have access to, so it can't go in the inner scope
            consolelog = get_lines(include_file)
            continue
        combined += '/* ' + include + '*/\n' + get_lines(include_file) + '\n\n'

    combined += '})();'
    if len(consolelog) > 0:
        # prepend this outside of our scope
        combined = consolelog + combined

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


def minify():
    '''Invoke terser to minify our build js files'''
    if not os.path.exists('tmp'):
        print("Nothing changed!")
        return

    options = [
        'booleans_as_integers',
        'ecma=6',
        'keep_fargs=false',
        'passes=3',
        'unsafe',
        'unsafe_math',
        'warnings',
        'arguments',
        'hoist_funs'
    ]

    files = glob.glob("tmp/*.js")
    for file in files:
        run_cmd(file, options)


def run_cmd(file, options):
    clean_file = file[file.find(os.sep) + 1:file.find('.')] + '.min.js'
    print('Minifying', clean_file)
    system = platform.system();
    if system == 'Windows':
        cmd_params = ' -c ' + ','.join(options) + ' -m'
        cmd = 'node.exe ' + os.environ['APPDATA'] + r'\npm\node_modules\terser\bin\terser '
        cmd += file + ' -o min\\' + clean_file + cmd_params
    elif system == 'Linux':
        cmd = ['terser', file, '-o', 'min/' + clean_file, '-c', ','.join(options), '-m']
    else:
        print('Unsupported OS:', os)
    output = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8')
    process_output(output)
    print()


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